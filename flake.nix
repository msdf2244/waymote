{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    utils.url = "github:numtide/flake-utils";
    mynvim.url = "github:msdf2244/my-nvim";
  };

  outputs = { self, nixpkgs, utils, mynvim }:
    utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        neovim = mynvim.packages.default;
      in
      {
        devShell = with pkgs; mkShell {
          buildInputs = [ cargo rustc rustfmt pre-commit rustPackages.clippy cargo-watch neovim ];
          RUST_SRC_PATH = rustPlatform.rustLibSrc;
        };
      }
    );
}
