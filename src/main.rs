use axum::{
    Router,
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    routing::any,
};
use log::{error, info};
use serde::{Deserialize, Serialize};
use std::{
    io::Write,
    process::{Command, Stdio},
};
use tower_http::services::ServeDir;

#[derive(Serialize, Deserialize, Debug)]
enum Action {
    Key { value: String },
    Niri { value: String },
    MouseMove { x: f64, y: f64 },
    Drag { amount: f64 },
    LeftClick,
    MiddleClick,
    RightClick,
}

fn dotoolc(command: &str) -> String {
    let mut child = Command::new("dotoolc")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();

    let stdin = child.stdin.as_mut().expect("Failed to open stdin");
    let input = command.as_bytes().to_vec();
    stdin.write_all(&input).unwrap();
    let output = child.wait_with_output().unwrap().stdout;
    String::from_utf8(output).unwrap()
}

fn niri(command: &str) -> String {
    let child = Command::new("niri")
        .arg("msg")
        .arg("action")
        .arg(command)
        .spawn()
        .unwrap();
    let output = child.wait_with_output().unwrap().stdout;
    String::from_utf8(output).unwrap()
}

async fn handle_message(socket: &mut WebSocket, message: &Message) {
    let msg = match message {
        Message::Text(bytes) => String::from_utf8(bytes.as_bytes().into()).unwrap(),
        _ => return,
    };
    let action = match serde_json::from_str(&msg) {
        Ok(payload) => payload,
        Err(e) => {
            error!("Message could not be deserialized: {msg:?} -> {e:?}");
            socket.send("Failure".into()).await.unwrap();
            return;
        }
    };
    info!("Message: {action:?}");
    let output = match action {
        Action::Key { value } => dotoolc(&format!("key {}\n", value)),
        Action::MouseMove { x, y } => dotoolc(&format!("mousemove {x} {y}\n")), 
        Action::Drag { amount } => dotoolc(&format!("wheel {amount}\n")), 
        Action::LeftClick => dotoolc("click left\n"),
        Action::MiddleClick => dotoolc("click middle\n"),
        Action::RightClick => dotoolc("click right\n"),
        Action::Niri { value } => niri(&value),
    };
    if output.len() > 0 {
        info!("Output: {output}");
    }
    let _ = socket.send("I understood your message!".into()).await;
}

async fn handler(mut socket: WebSocket) {
    while let Some(msg) = socket.recv().await {
        match msg {
            Ok(msg) => handle_message(&mut socket, &msg).await,
            _ => return,
        }
    }
}

#[tokio::main]
async fn main() {
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

    Command::new("dotoold").spawn().unwrap();

    let listener = tokio::net::TcpListener::bind(&address).await.unwrap();
    info!("Serving http://{address}/static/index.html");
    axum::serve(listener, app).await.unwrap();
}
