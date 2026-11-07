//! The /fleet/bike-factory/ page: bridges grouped by repo, which bridgeman holds which card,
//! blocked vs working, and the queue of BS cards not yet picked up. Built on the `fleet-scene` crate.
//!
//! Data: `fleet/fixture.json` (`bike_factory.bridges`, `bike_factory.queue`) or live state from
//! `bin/fleet-state.sh`. Map: `docs/fleet-page-map.md`.

use fleet_scene::{Fleet, Lane, Paint, QueueCard, pill, state_color, tag};
pub use fleet_scene::{AppSpec, State};
use rune::tok::{self, radius, space, type_};
use rune::{Cx, El, ScrollSpec, TextStyle, col, el, row, text};

pub const SIZE: (f32, f32) = (1120.0, 760.0);

/// Bridges grouped by repo, in first-seen order. A bridge with no repo set falls under "other".
pub fn by_repo(bridges: &[Lane]) -> Vec<(String, Vec<&Lane>)> {
    let mut groups: Vec<(String, Vec<&Lane>)> = Vec::new();
    for b in bridges {
        let repo = if b.repo.is_empty() { "other" } else { b.repo.as_str() };
        match groups.iter_mut().find(|(r, _)| r == repo) {
            Some((_, v)) => v.push(b),
            None => groups.push((repo.to_owned(), vec![b])),
        }
    }
    groups
}

/// Queue cards nobody holds yet.
pub fn waiting(queue: &[QueueCard]) -> Vec<&QueueCard> {
    queue.iter().filter(|c| c.state != "picked up").collect()
}

fn count(bridges: &[&Lane], state: &str) -> usize {
    bridges.iter().filter(|b| b.state == state).count()
}

fn bridge_row(p: Paint, key: &str, b: &Lane) -> El {
    let t = p.t;
    let card = if b.card.is_empty() { "no card".to_owned() } else { b.card.clone() };
    let holder = if b.holder.is_empty() { "no bridgeman".to_owned() } else { b.holder.clone() };
    row().key(key).w_full().h(40.0).px(space::S3).gap(space::S3).center_y().role("row").label(&b.name)
        .child(text(&holder).key("holder").font(type_::TITLE).color(t.text).w(190.0).truncate())
        .child(pill(p, &b.state))
        .child(text(card).key("card").font(type_::BODY)
            .color(if b.card.is_empty() { t.text_secondary } else { t.text }).grow(1.0).truncate())
}

fn queue_row(p: Paint, key: &str, c: &QueueCard) -> El {
    let t = p.t;
    let state = if c.state.is_empty() { "queued" } else { c.state.as_str() };
    let color = if state == "queued" { state_color("blocked") } else { state_color("working") };
    row().key(key).w_full().h(36.0).px(space::S3).gap(space::S3).center_y().role("row").label(&c.id)
        .child(text(&c.id).key("id").font(type_::TITLE).color(t.text).w(90.0))
        .child(text(&c.title).key("title").font(type_::BODY).color(t.text).grow(1.0).truncate())
        .child(tag(state, color))
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

fn section(p: Paint, key: &str, title: &str, summary: Option<String>, body: El) -> El {
    let mut head = col().key("head").gap(2.0).ml(space::S3)
        .child(text(title).key("header").font(TextStyle::new(20.0, 700.0)).color(p.t.text));
    if let Some(s) = summary {
        head = head.child(text(s).key("summary").font(type_::BODY).color(p.t.text_secondary));
    }
    col().key(key).w_full().gap(space::S2).role("region").label(title).child(head).child(body)
}

pub fn view(s: &State, cx: &mut Cx<State>) -> El {
    let t = tok::theme(true);
    let p = Paint { t, hair: 1.0 / cx.env().scale };
    let f: &Fleet = &s.fleet;
    let bf = &f.bike_factory;

    let mut sections: Vec<El> = by_repo(&bf.bridges).iter().enumerate().map(|(i, (repo, bs))| {
        let rows = bs.iter().enumerate().map(|(j, b)| bridge_row(p, &format!("bridge{j}"), b)).collect();
        let sum = format!("{} {} · {} working · {} blocked", bs.len(), if bs.len() == 1 { "bridge" } else { "bridges" }, count(bs, "working"), count(bs, "blocked"));
        section(p, &format!("repo{i}"), repo, Some(sum), card_of(p, rows, "no bridges"))
    }).collect();
    if sections.is_empty() {
        sections.push(section(p, "none", "Bridges", None, card_of(p, vec![], "no bridges building")));
    }
    let wait = waiting(&bf.queue);
    let rows = wait.iter().enumerate().map(|(i, c)| queue_row(p, &format!("q{i}"), c)).collect();
    sections.push(section(p, "queue", "Queue", Some(format!("{} BS cards not yet picked up", wait.len())),
        card_of(p, rows, "queue empty")));

    let stamp = if f.masked { format!("fixture, masked · {}", f.generated_at) } else { format!("live · {}", f.generated_at) };
    col().key("window").role("window").w_full().h_full().fill(t.bg)
        .child(col().key("page").w_full().grow(1.0).min_h(0.0).px(space::S6).pt(space::S6).gap(space::S3)
            .child(col().key("head").gap(2.0).ml(space::S3)
                .child(text("Bike Factory").key("title").font(TextStyle::new(24.0, 700.0)).color(t.text))
                .child(text("agent infrastructure: bridges by repo, who holds which card, and the BS queue")
                    .key("subtitle").font(type_::BODY).color(t.text_secondary)))
            .child(col().key("sections").w_full().grow(1.0).min_h(0.0).gap(space::S6).pb(space::S3)
                .scroll(ScrollSpec { stick_bottom: false }).scroll_edge_fade(16.0)
                .children(sections)))
        .child(row().key("foot").w_full().h(32.0).px(space::S6).center_y().justify_between()
            .child(text("justingriffiths.com/fleet/bike-factory/").key("where").font(type_::LABEL).color(t.text_secondary))
            .child(text(stamp).key("stamp").font(type_::LABEL).color(t.text_secondary)))
}

pub fn spec() -> AppSpec<State> {
    let mut s = AppSpec::new("Bike Factory", SIZE, State::default, view);
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
    fn bridges_group_by_repo() {
        let f = fixture();
        let g = by_repo(&f.bike_factory.bridges);
        assert_eq!(g.len(), 3);
        assert_eq!(g[0].0, "anansi-agent");
        assert_eq!(g[0].1[0].holder, "AGT_BLD_anansi-112");
    }

    #[test]
    fn queue_lists_only_unpicked_cards() {
        let f = fixture();
        let w = waiting(&f.bike_factory.queue);
        assert_eq!(w.len(), 3);
        assert!(w.iter().all(|c| c.state == "queued"));
    }

    #[test]
    fn fixture_holds_no_real_client_name() {
        let raw = fleet_scene::FIXTURE.to_lowercase();
        for bad in ["urban", "moonshine", "@"] { assert!(!raw.contains(bad), "fixture leaks {bad}"); }
    }
}
