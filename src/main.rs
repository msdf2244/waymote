use anyhow::{Result, bail};
use applications::{App, AppInfo, AppInfoContext, common::SearchPath};
use axum::{
    Router,
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    routing::any,
};
use enigo::{Axis, Button, Coordinate, Direction, Enigo, Key, Keyboard, Mouse, Settings};
use log::info;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tower_http::services::ServeDir;

#[derive(Serialize, Deserialize, Debug)]
enum Action {
    KeyCode { value: String },
    Unicode { value: char },
    MouseMove { x: i32, y: i32 },
    Scroll { x: i32, y: i32 },
    LeftClick,
    MiddleClick,
    RightClick,
    Open { value: String },
    IncreaseVolume,
    DecreaseVolume,
    ToggleMuteVolume,
    GetCapabilities,
}

#[derive(Serialize, Deserialize, Debug)]
enum Response {
    Capabilities { apps: Vec<String> },
}

fn get_available_apps() -> Result<Vec<App>> {
    let mut ctx = AppInfoContext::new(vec![SearchPath::new(
        PathBuf::from("/run/current-system/sw/share/applications/"),
        1,
    )]);
    ctx.refresh_apps()?;
    Ok(ctx.get_all_apps())
}

async fn handle_message(
    socket: &mut WebSocket,
    enigo: &mut Enigo,
    message: &Message,
) -> Result<()> {
    let msg = match message {
        Message::Text(bytes) => String::from_utf8(bytes.as_bytes().into())?,
        _ => bail!("Message could not be understood as text"),
    };
    info!("Raw: {msg:?}");
    let action: Action = serde_json::from_str(&msg)?;
    info!("Message: {action:?}");
    match action {
        Action::MouseMove { x, y } => enigo.move_mouse(x, y, Coordinate::Rel)?,
        Action::KeyCode { value } => match value.as_ref() {
            "Backspace" => enigo.key(Key::Backspace, Direction::Click)?,
            "Return" => enigo.key(Key::Return, Direction::Click)?,
            "Escape" => enigo.key(Key::Escape, Direction::Click)?,
            _ => bail!("Unrecognized key code: {value}"),
        },
        Action::Unicode { value } => enigo.key(Key::Unicode(value), Direction::Click)?,
        Action::Scroll { x, y } => {
            enigo.scroll(x, Axis::Horizontal)?;
            enigo.scroll(y, Axis::Vertical)?;
        }
        Action::LeftClick => enigo.button(Button::Left, Direction::Click)?,
        Action::MiddleClick => enigo.button(Button::Middle, Direction::Click)?,
        Action::RightClick => enigo.button(Button::Right, Direction::Click)?,
        Action::Open { value: _ } => todo!(),
        Action::ToggleMuteVolume => enigo.key(Key::VolumeMute, Direction::Click)?,
        Action::DecreaseVolume => enigo.key(Key::VolumeDown, Direction::Click)?,
        Action::IncreaseVolume => enigo.key(Key::VolumeUp, Direction::Click)?,
        Action::GetCapabilities => {
            let apps = get_available_apps()?;
            let response = Response::Capabilities {
                apps: apps.iter().map(|app| app.name.clone()).collect(),
            };
            info!("{apps:?}");
            let payload = serde_json::to_string(&response)?;
            socket.send(Message::Text(payload.into())).await?;
        }
    };
    socket.send("I understood your message!".into()).await?;
    Ok(())
}

async fn handler(mut socket: WebSocket) {
    let mut enigo =
        Enigo::new(&Settings::default()).expect("Could not establish connection to input system");
    while let Some(message) = socket.recv().await {
        match message {
            Ok(message) => handle_message(&mut socket, &mut enigo, &message)
                .await
                .expect("Failure while handling message from client"),
            _ => return,
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::init();
    // build our application with a single route
    let app = Router::new()
        .route(
            "/remote",
            any(async |ws: WebSocketUpgrade| {
                info!("New connection?");
                ws.on_upgrade(handler)
            }),
        )
        .nest_service("/static", ServeDir::new("public")); // Serve files from 'public' directory under /static;

    let port = "3000";
    let host = "0.0.0.0";
    let address = format!("{}:{}", host, port);

    let listener = tokio::net::TcpListener::bind(&address).await?;
    info!("Serving http://{address}/static/index.html");
    axum::serve(listener, app).await?;
    Ok(())
}
