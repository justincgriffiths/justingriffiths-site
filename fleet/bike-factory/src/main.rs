//! Native entry for the bike-factory page: headless snapshots and a desktop window.
//! `FLEET_STATE=/path/state.json` draws live state instead of the committed fixture.
use bike_factory::{AppSpec, SIZE, State, view};

fn init() -> State {
    match std::env::var("FLEET_STATE").ok().and_then(|p| std::fs::read_to_string(p).ok()) {
        Some(json) => State::from_json(&json),
        None => State::default(),
    }
}

fn main() {
    rune::run(AppSpec::new("Bike Factory", SIZE, init, view));
}
