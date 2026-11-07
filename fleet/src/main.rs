//! Native entry: the same scene, for headless snapshots and a desktop window.
//! `FLEET_STATE=/path/to/state.json` draws live state instead of the committed fixture.
//! `cargo run -- --snap out.png --size 1120x760 --scale 2` writes a PNG; `--tree tree.json` dumps the tree.
use fleet_scene::{AppSpec, SIZE, State, view};

fn init() -> State {
    match std::env::var("FLEET_STATE").ok().and_then(|p| std::fs::read_to_string(p).ok()) {
        Some(json) => State::from_json(&json),
        None => State::default(),
    }
}

fn main() {
    rune::run(AppSpec::new("Fleet", SIZE, init, view));
}
