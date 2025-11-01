{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    utils.url = "github:numtide/flake-utils";
    mynvim.url = "github:msdf2244/my-nvim";
  };

  outputs =
    {
      self,
      nixpkgs,
      utils,
      mynvim,
    }:
    utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
        neovim = mynvim.packages.default;
      in
      {
        packages.default = pkgs.rustPlatform.buildRustPackage {
          pname = "waymote";
          version = "0.1.0";

          src = pkgs.lib.cleanSource ./.;

          cargoLock.lockFile = ./Cargo.lock;
          buildInputs = with pkgs; [
            pkg-config
            udev
            libxkbcommon
          ];
          postInstall = ''cp -r ./public/ $out/public'';
        };
        devShell =
          with pkgs;
          mkShell {
            buildInputs = [
              cargo
              rustc
              rustfmt
              pre-commit
              rustPackages.clippy
              cargo-watch
              pkg-config
              udev
              libxkbcommon
              neovim
            ];
            RUST_SRC_PATH = rustPlatform.rustLibSrc;
            RUST_LOG = "info";
          };
      }
    );
}
