//! The /fleet/ scene at N=1: two worlds side by side, drawn by Rune from one fleet-state JSON.
//!
//! Left, **battle school**: ✦BEAN's client work. One army per client; its toons are channels or
//! capabilities (A read, B write, C analysis, D creative, E tracking, F comms, G access).
//! Right, the **Bike Factory**: agent infrastructure. Seats hold the desks; bridges are the lane
//! sessions building infra, which ■KALADIN runs.
//!
//! Every lane shows its name, its state (working, blocked or idle) and the card it holds.
//! The JSON comes from `bin/fleet-state.sh` (live, gitignored) or `fixture.json` (masked, committed).

use rune::tok::{self, radius, space, type_};
pub use rune::AppSpec;
use rune::{Color, Cx, El, ScrollSpec, TextStyle, col, el, oklch, row, text};
use serde::Deserialize;

pub const FIXTURE: &str = include_str!("../fixture.json");
pub const SIZE: (f32, f32) = (1120.0, 640.0);
/// DejaVu Sans (free licence) cut down to ✦ ◆ ● ■ ▲, the seat marks Rune's bundled fonts lack.
pub const GLYPHS: &[u8] = include_bytes!("glyphs.ttf");
/// Fonts to hand `AppSpec::fonts`: the web build has no system fonts, so it carries the seat marks.
/// Native keeps its own (a non-empty list there would replace Inter).
#[cfg(target_arch = "wasm32")]
pub const FONTS: &[&[u8]] = &[GLYPHS];
#[cfg(not(target_arch = "wasm32"))]
pub const FONTS: &[&[u8]] = &[];

#[derive(Deserialize, Clone, Debug, Default)]
pub struct Fleet {
    #[serde(default)]
    pub generated_at: String,
    #[serde(default)]
    pub masked: bool,
    #[serde(default)]
    pub battle_school: BattleSchool,
    #[serde(default)]
    pub bike_factory: BikeFactory,
}

#[derive(Deserialize, Clone, Debug, Default)]
pub struct BattleSchool {
    #[serde(default)]
    pub armies: Vec<Army>,
}

#[derive(Deserialize, Clone, Debug, Default)]
pub struct Army {
    pub name: String,
    #[serde(default)]
    pub toons: Vec<Lane>,
    /// From `armies/<client>/pack.yaml` `connections:` (bean-agent): what each probe answered.
    #[serde(default)]
    pub connections: Vec<Conn>,
    #[serde(default)]
    pub probed_by: String,
}

/// One probed connection. `result` is `ok`, `not probed`, `none wired` or a failure; `use_for` lists toon letters.
#[derive(Deserialize, Clone, Debug, Default)]
pub struct Conn {
    pub channel: String,
    #[serde(default)]
    pub label: String,
    #[serde(default)]
    pub result: String,
    #[serde(default)]
    pub probed_on: String,
    #[serde(default)]
    pub note: String,
    #[serde(default)]
    pub use_for: Vec<String>,
}

#[derive(Deserialize, Clone, Debug, Default)]
pub struct BikeFactory {
    #[serde(default)]
    pub seats: Vec<Lane>,
    #[serde(default)]
    pub bridges: Vec<Lane>,
    /// BS-* cards in bike-shop `queue/`: `queued` until a bridge picks one up.
    #[serde(default)]
    pub queue: Vec<QueueCard>,
}

/// One BS card in the bike-shop queue.
#[derive(Deserialize, Clone, Debug, Default)]
pub struct QueueCard {
    pub id: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub state: String,
}

/// One lane: a toon, a seat or a bridge. `state` is `working`, `blocked` or `idle`.
#[derive(Deserialize, Clone, Debug, Default)]
pub struct Lane {
    pub name: String,
    #[serde(default)]
    pub state: String,
    #[serde(default)]
    pub card: String,
    #[serde(default)]
    pub note: String,
    /// Bridges only: the repo the lane builds in, and the session (bridgeman) holding the card.
    #[serde(default)]
    pub repo: String,
    #[serde(default)]
    pub holder: String,
}

pub struct State {
    pub fleet: Fleet,
}

impl State {
    pub fn from_json(json: &str) -> Self {
        let fleet = serde_json::from_str(json).unwrap_or_else(|e| Fleet {
            generated_at: format!("bad fleet state: {e}"),
            ..Fleet::default()
        });
        Self { fleet }
    }
}

impl Default for State {
    fn default() -> Self {
        Self::from_json(FIXTURE)
    }
}

#[derive(Clone, Copy)]
pub struct Paint {
    pub t: tok::Theme,
    pub hair: f32,
}

pub fn state_color(state: &str) -> Color {
    match state {
        "working" => oklch(0.78, 0.17, 150.0), // green
        "blocked" => oklch(0.74, 0.19, 30.0),  // red-orange
        _ => oklch(0.62, 0.02, 250.0),         // idle: grey
    }
}

pub fn pill(_p: Paint, state: &str) -> El {
    let label = if state.is_empty() { "idle" } else { state };
    tag(label, state_color(state))
}

/// A coloured status pill with any label.
pub fn tag(label: &str, c: Color) -> El {
    row().key("state").h(20.0).px(space::S2).gap(6.0).center_y().radius(10.0)
        .fill(Color { a: 0.16, ..c })
        .child(el().key("dot").size(7.0, 7.0).radius(3.5).fill(c).a11y_hidden())
        .child(text(label).key("label").font(TextStyle::new(11.0, 600.0)).color(c))
        .child(el().key("pad").w(2.0).a11y_hidden())
        .a11y_hidden()
        .label(label)
}

pub fn lane(p: Paint, key: &str, l: &Lane) -> El {
    let t = p.t;
    let card = if l.card.is_empty() { "no card".to_owned() } else { l.card.clone() };
    row().key(key).w_full().h(40.0).px(space::S3).gap(space::S3).center_y().role("row").label(&l.name)
        .child(text(&l.name).key("name").font(type_::TITLE).color(t.text).w(170.0).truncate())
        .child(pill(p, &l.state))
        .child(text(card).key("card").font(type_::BODY)
            .color(if l.card.is_empty() { t.text_secondary } else { t.text }).grow(1.0).truncate())
}

pub fn lanes(p: Paint, key: &str, title: &str, items: &[Lane], empty: &str) -> El {
    let t = p.t;
    let mut card = col().key("card").padding(space::S1).fill(t.card).radius(radius::LG)
        .border(p.hair, t.card_border).shadow(1.0, 2.0, t.shadow).shadow(8.0, 24.0, t.shadow_soft);
    if items.is_empty() {
        card = card.child(text(empty).key("empty").font(type_::BODY).color(t.text_secondary).padding(space::S3));
    }
    for (i, l) in items.iter().enumerate() {
        card = card.child(lane(p, &format!("lane{i}"), l));
        if i + 1 < items.len() {
            card = card.child(el().key(format!("sep{i}")).h(p.hair).ml(space::S3).mr(space::S3).fill(t.separator).a11y_hidden());
        }
    }
    col().key(key).w_full().gap(space::S2)
        .child(text(title).key("header").font(type_::SECTION).color(t.text_secondary).ml(space::S3))
        .child(card)
}

pub fn world(p: Paint, key: &str, title: &str, subtitle: &str, sections: Vec<El>) -> El {
    let t = p.t;
    col().key(key).grow(1.0).min_w(0.0).h_full().gap(space::S3).px(space::S3).role("region").label(title)
        .child(col().key("head").gap(2.0).ml(space::S3).mt(space::S2)
            .child(text(title).key("title").font(TextStyle::new(20.0, 700.0)).color(t.text))
            .child(text(subtitle).key("subtitle").font(type_::BODY).color(t.text_secondary)))
        .child(col().key("sections").w_full().grow(1.0).min_h(0.0).gap(space::S3).pb(space::S3)
            .scroll(ScrollSpec { stick_bottom: false }).scroll_edge_fade(16.0)
            .children(sections))
}

pub fn view(s: &State, cx: &mut Cx<State>) -> El {
    let t = tok::theme(true);
    let p = Paint { t, hair: 1.0 / cx.env().scale };
    let f = &s.fleet;

    let mut battle = Vec::new();
    for (i, a) in f.battle_school.armies.iter().enumerate() {
        battle.push(lanes(p, &format!("army{i}"), &format!("Army · {}", a.name), &a.toons, "no toons"));
    }
    if battle.is_empty() {
        battle.push(lanes(p, "army-none", "Armies", &[], "no armies in the snapshot"));
    }

    let factory = vec![
        lanes(p, "seats", "Seats", &f.bike_factory.seats, "no seats"),
        lanes(p, "bridges", "Bridges · run by ■KALADIN", &f.bike_factory.bridges, "no bridges building"),
    ];

    let stamp = if f.masked {
        format!("fixture, masked · {}", f.generated_at)
    } else {
        format!("live · {}", f.generated_at)
    };

    col().key("window").role("window").w_full().h_full().fill(t.bg)
        .child(row().key("worlds").w_full().grow(1.0).min_h(0.0).pt(space::S3).gap(0.0)
            .child(world(p, "battle-school", "Battle school", "✦BEAN's client work: armies are clients, toons are channels", battle))
            .child(el().key("divider").w(p.hair).h_full().fill(t.separator).my(space::S6).a11y_hidden())
            .child(world(p, "bike-factory", "Bike Factory", "agent infrastructure: seats hold desks, bridges build lanes", factory)))
        .child(row().key("foot").w_full().h(32.0).px(space::S6).center_y().justify_between()
            .child(text("justingriffiths.com/fleet/ · N=1").key("where").font(type_::LABEL).color(t.text_secondary))
            .child(text(stamp).key("stamp").font(type_::LABEL).color(t.text_secondary)))
}

pub fn spec() -> AppSpec<State> {
    let mut s = AppSpec::new("Fleet", SIZE, State::default, view);
    s.fonts = FONTS;
    s
}

#[cfg(all(target_arch = "wasm32", feature = "start"))]
#[wasm_bindgen::prelude::wasm_bindgen(start)]
pub fn start() {
    rune::run(spec());
}
