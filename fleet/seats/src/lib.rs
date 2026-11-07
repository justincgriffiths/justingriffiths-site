//! The /fleet/seats/ page: the envelope flow between seats, the latest state per card, and what waits
//! on Justin. Built on the `fleet-scene` crate.
//!
//! Data: `fleet/fixture.json` (`seat_flow`) or live state from `bin/fleet-state.sh`. Map: `docs/fleet-page-map.md`.

use fleet_scene::{Ask, Envelope, Fleet, Paint, state_color, tag};
pub use fleet_scene::{AppSpec, State};
use rune::tok::{self, radius, space, type_};
use rune::{Cx, El, ScrollSpec, TextStyle, col, el, row, text};

pub const SIZE: (f32, f32) = (1120.0, 860.0);

/// The newest envelope for each card, newest first. Envelopes with no card are skipped.
pub fn latest_per_card(envelopes: &[Envelope]) -> Vec<&Envelope> {
    let mut latest: Vec<&Envelope> = Vec::new();
    for e in envelopes.iter().filter(|e| !e.card.is_empty()) {
        match latest.iter_mut().find(|l| l.card == e.card) {
            Some(slot) => if e.ts >= slot.ts { *slot = e },
            None => latest.push(e),
        }
    }
    latest.sort_by(|a, b| b.ts.cmp(&a.ts));
    latest
}

/// Envelopes newest first, as the page lists the flow.
pub fn flow(envelopes: &[Envelope]) -> Vec<&Envelope> {
    let mut v: Vec<&Envelope> = envelopes.iter().collect();
    v.sort_by(|a, b| b.ts.cmp(&a.ts));
    v
}

/// "2026-11-07T15:04:51Z" → "11-07 15:04". Anything shorter passes through.
pub fn short_ts(ts: &str) -> String {
    match (ts.get(5..10), ts.get(11..16)) {
        (Some(d), Some(t)) => format!("{d} {t}"),
        _ => ts.to_owned(),
    }
}

/// Envelope states drawn with the scene's three colours: blocked stays blocked, done goes quiet.
fn state_tone(state: &str) -> &'static str {
    match state { "blocked" => "blocked", "done" => "idle", _ => "working" }
}

fn envelope_row(p: Paint, key: &str, e: &Envelope) -> El {
    let t = p.t;
    let label = format!("{} to {} {}", e.from, e.to, e.verb);
    row().key(key).w_full().h(40.0).px(space::S3).gap(space::S3).center_y().role("row").label(&label)
        .child(text(short_ts(&e.ts)).key("ts").font(type_::LABEL).color(t.text_secondary).w(86.0))
        .child(text(format!("{} → {}", e.from, e.to)).key("route").font(type_::TITLE).color(t.text).w(330.0).truncate())
        .child(row().key("verb").w(96.0).child(tag(&e.verb, t.text_secondary)))
        .child(text(&e.card).key("card").font(type_::BODY).color(t.text).w(180.0).truncate())
        .child(text(&e.note).key("note").font(type_::BODY).color(t.text_secondary).grow(1.0).truncate())
        .child(row().key("state").w(84.0).justify_end().child(tag(&e.state, state_color(state_tone(&e.state)))))
}

fn ask_row(p: Paint, key: &str, a: &Ask) -> El {
    let t = p.t;
    row().key(key).w_full().h(40.0).px(space::S3).gap(space::S3).center_y().role("row").label(&a.card)
        .child(text(&a.seat).key("seat").font(type_::TITLE).color(t.text).w(190.0).truncate())
        .child(text(&a.card).key("card").font(type_::BODY).color(t.text).w(180.0).truncate())
        .child(text(&a.ask).key("ask").font(type_::BODY).color(t.text_secondary).grow(1.0).truncate())
}

fn card_of(p: Paint, rows: Vec<El>, empty: &str) -> El {
    let t = p.t;
    let mut c = col().key("card").padding(space::S1).fill(t.card).radius(radius::LG)
        .border(p.hair, t.card_border).shadow(1.0, 2.0, t.shadow).shadow(8.0, 24.0, t.shadow_soft);
    if rows.is_empty() {
        c = c.child(text(empty).key("empty").font(type_::BODY).color(t.text_secondary).padding(space::S3));
    }
    let n = rows.len();
    for (i, r) in rows.into_iter().enumerate() {
        c = c.child(r);
        if i + 1 < n {
            c = c.child(el().key(format!("sep{i}")).h(p.hair).ml(space::S3).mr(space::S3).fill(t.separator).a11y_hidden());
        }
    }
    c
}

fn section(p: Paint, key: &str, title: &str, summary: String, body: El) -> El {
    let head = col().key("head").gap(2.0).ml(space::S3)
        .child(text(title).key("header").font(TextStyle::new(20.0, 700.0)).color(p.t.text))
        .child(text(summary).key("summary").font(type_::BODY).color(p.t.text_secondary));
    col().key(key).w_full().gap(space::S2).role("region").label(title).child(head).child(body)
}

pub fn view(s: &State, cx: &mut Cx<State>) -> El {
    let t = tok::theme(true);
    let p = Paint { t, hair: 1.0 / cx.env().scale };
    let f: &Fleet = &s.fleet;
    let sf = &f.seat_flow;

    let asks = sf.waiting_on_justin.iter().enumerate().map(|(i, a)| ask_row(p, &format!("ask{i}"), a)).collect();
    let latest = latest_per_card(&sf.envelopes);
    let latest_rows = latest.iter().enumerate().map(|(i, e)| envelope_row(p, &format!("card{i}"), e)).collect();
    let all = flow(&sf.envelopes);
    let flow_rows = all.iter().enumerate().map(|(i, e)| envelope_row(p, &format!("env{i}"), e)).collect();

    let sections = vec![
        section(p, "waiting", "Waiting on you",
            format!("{} {} parked for a decision", sf.waiting_on_justin.len(), if sf.waiting_on_justin.len() == 1 { "card" } else { "cards" }),
            card_of(p, asks, "nothing waiting on you")),
        section(p, "latest", "Latest per card",
            format!("{} cards, each at its newest envelope", latest.len()),
            card_of(p, latest_rows, "no cards on the buses")),
        section(p, "flow", "Envelope flow",
            format!("{} envelopes across the seat buses, newest first", all.len()),
            card_of(p, flow_rows, "no envelopes yet")),
    ];

    let stamp = if f.masked { format!("fixture, masked · {}", f.generated_at) } else { format!("live · {}", f.generated_at) };
    col().key("window").role("window").w_full().h_full().fill(t.bg)
        .child(col().key("page").w_full().grow(1.0).min_h(0.0).px(space::S6).pt(space::S6).gap(space::S3)
            .child(col().key("head").gap(2.0).ml(space::S3)
                .child(text("Seats").key("title").font(TextStyle::new(24.0, 700.0)).color(t.text))
                .child(text("who dispatched what to whom, the latest state per card, and what is waiting on Justin")
                    .key("subtitle").font(type_::BODY).color(t.text_secondary)))
            .child(col().key("sections").w_full().grow(1.0).min_h(0.0).gap(space::S6).pb(space::S3)
                .scroll(ScrollSpec { stick_bottom: false }).scroll_edge_fade(16.0)
                .children(sections)))
        .child(row().key("foot").w_full().h(32.0).px(space::S6).center_y().justify_between()
            .child(text("justingriffiths.com/fleet/seats/").key("where").font(type_::LABEL).color(t.text_secondary))
            .child(text(stamp).key("stamp").font(type_::LABEL).color(t.text_secondary)))
}

pub fn spec() -> AppSpec<State> {
    let mut s = AppSpec::new("Seats", SIZE, State::default, view);
    s.fonts = fleet_scene::FONTS;
    s
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen(start)]
pub fn start() {
    rune::run(spec());
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> Fleet { State::default().fleet }

    #[test]
    fn latest_keeps_the_newest_envelope_per_card() {
        let f = fixture();
        let l = latest_per_card(&f.seat_flow.envelopes);
        assert_eq!(l.len(), 4);
        let k71 = l.iter().find(|e| e.card == "bike-shop#71").unwrap();
        assert_eq!(k71.state, "blocked");
        assert_eq!(k71.from, "■KALADIN");
    }

    #[test]
    fn latest_is_newest_first() {
        let f = fixture();
        let l = latest_per_card(&f.seat_flow.envelopes);
        assert!(l.windows(2).all(|w| w[0].ts >= w[1].ts));
        assert_eq!(l[0].card, "queue/BS-024.md");
    }

    #[test]
    fn flow_lists_every_envelope_newest_first() {
        let f = fixture();
        let v = flow(&f.seat_flow.envelopes);
        assert_eq!(v.len(), f.seat_flow.envelopes.len());
        assert!(v.windows(2).all(|w| w[0].ts >= w[1].ts));
    }

    #[test]
    fn short_ts_trims_to_day_and_minute() {
        assert_eq!(short_ts("2026-11-07T15:04:51Z"), "11-07 15:04");
        assert_eq!(short_ts("n/a"), "n/a");
    }

    #[test]
    fn one_ask_waits_on_justin() {
        let f = fixture();
        assert_eq!(f.seat_flow.waiting_on_justin.len(), 1);
        assert_eq!(f.seat_flow.waiting_on_justin[0].card, "mycroft#647");
    }

    #[test]
    fn fixture_holds_no_real_client_name() {
        let raw = fleet_scene::FIXTURE.to_lowercase();
        for bad in ["urban", "moonshine", "@"] { assert!(!raw.contains(bad), "fixture leaks {bad}"); }
    }
}
