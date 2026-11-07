//! The /fleet/battle-school/ page: one army per client, its seven toons (A read, B write,
//! C analysis, D creative, E tracking, F comms, G access), each toon's state and card, and which
//! connection each toon probed and when. Built on the `fleet-scene` crate (same JSON, same look).
//!
//! Data: `fleet/fixture.json` (masked) or live state from `bin/fleet-state.sh`. The connection rows
//! mirror the `connections:` block of `armies/<client>/pack.yaml` in bean-agent.

use fleet_scene::{Army, Conn, Fleet, Lane, Paint, pill, state_color, tag};
pub use fleet_scene::{AppSpec, State};
use rune::tok::{self, radius, space, type_};
use rune::{Color, Cx, El, ScrollSpec, TextStyle, col, el, row, text};

pub const SIZE: (f32, f32) = (1120.0, 900.0);

fn result_color(result: &str) -> Color {
    match result {
        "ok" => state_color("working"),
        "not probed" | "none wired" | "" => state_color("idle"),
        _ => state_color("blocked"),
    }
}

/// The channels a toon read through, and when: from the army's connections that name its letter.
pub fn probed(a: &Army, toon: &Lane) -> String {
    let letter = toon.name.chars().next().unwrap_or(' ').to_string();
    let mine: Vec<&Conn> = a.connections.iter().filter(|c| c.use_for.iter().any(|u| u.eq_ignore_ascii_case(&letter))).collect();
    if mine.is_empty() {
        return "no connection".to_owned();
    }
    let mut channels: Vec<&str> = Vec::new();
    for c in &mine {
        if !channels.contains(&c.channel.as_str()) {
            channels.push(&c.channel);
        }
    }
    let newest = mine.iter().map(|c| c.probed_on.as_str()).max().unwrap_or("");
    format!("{} · {}", channels.join(", "), newest.get(5..).unwrap_or(newest))
}

fn toon_row(p: Paint, key: &str, a: &Army, l: &Lane) -> El {
    let t = p.t;
    let card = if l.card.is_empty() { "no card".to_owned() } else { l.card.clone() };
    let who = probed(a, l);
    row().key(key).w_full().h(40.0).px(space::S3).gap(space::S3).center_y().role("row").label(&l.name)
        .child(text(&l.name).key("name").font(type_::TITLE).color(t.text).w(130.0).truncate())
        .child(pill(p, &l.state))
        .child(text(card).key("card").font(type_::BODY)
            .color(if l.card.is_empty() { t.text_secondary } else { t.text }).grow(1.0).truncate())
        .child(text(who).key("probed").font(type_::LABEL).color(t.text_secondary).w(260.0).truncate())
}

fn conn_row(p: Paint, key: &str, c: &Conn) -> El {
    let t = p.t;
    let label = if c.label.is_empty() { c.channel.clone() } else { c.label.clone() };
    let result = if c.result.is_empty() { "unknown" } else { c.result.as_str() };
    let toons = if c.use_for.is_empty() { "no toon".to_owned() } else { format!("toons {}", c.use_for.join(" ")) };
    let when = if c.probed_on.is_empty() { "never".to_owned() } else { c.probed_on.clone() };
    row().key(key).w_full().h(36.0).px(space::S3).gap(space::S3).center_y().role("row").label(&label)
        .child(text(&c.channel).key("channel").font(type_::TITLE).color(t.text).w(90.0).truncate())
        .child(text(label).key("label").font(type_::BODY).color(t.text).grow(1.0).truncate())
        .child(tag(result, result_color(result)))
        .child(text(when).key("when").font(type_::LABEL).color(t.text_secondary).w(80.0))
        .child(text(toons).key("toons").font(type_::LABEL).color(t.text_secondary).w(90.0).truncate())
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

fn section(p: Paint, key: &str, title: &str, body: El) -> El {
    col().key(key).w_full().gap(space::S2)
        .child(text(title).key("header").font(tok::type_::SECTION).color(p.t.text_secondary).ml(space::S3))
        .child(body)
}

fn army(p: Paint, i: usize, a: &Army) -> El {
    let t = p.t;
    let ok = a.connections.iter().filter(|c| c.result == "ok").count();
    let working = a.toons.iter().filter(|l| l.state == "working").count();
    let blocked = a.toons.iter().filter(|l| l.state == "blocked").count();
    let toons: Vec<El> = a.toons.iter().enumerate().map(|(j, l)| toon_row(p, &format!("toon{j}"), a, l)).collect();
    let conns: Vec<El> = a.connections.iter().enumerate().map(|(j, c)| conn_row(p, &format!("conn{j}"), c)).collect();
    let by = if a.probed_by.is_empty() { String::new() } else { format!(" · probed by {}", a.probed_by) };
    col().key(format!("army{i}")).w_full().gap(space::S3).role("region").label(&a.name)
        .child(col().key("head").gap(2.0).ml(space::S3)
            .child(text(&a.name).key("title").font(TextStyle::new(20.0, 700.0)).color(t.text))
            .child(text(format!("{} toons · {working} working · {blocked} blocked · {ok} of {} connections answered{by}", a.toons.len(), a.connections.len()))
                .key("summary").font(type_::BODY).color(t.text_secondary)))
        .child(section(p, "toons", "Toons", card_of(p, toons, "no toons")))
        .child(section(p, "conns", "Connections", card_of(p, conns, "no connections probed")))
}

pub fn view(s: &State, cx: &mut Cx<State>) -> El {
    let t = tok::theme(true);
    let p = Paint { t, hair: 1.0 / cx.env().scale };
    let f: &Fleet = &s.fleet;
    let armies: Vec<El> = if f.battle_school.armies.is_empty() {
        vec![section(p, "none", "Armies", card_of(p, vec![], "no armies in the snapshot"))]
    } else {
        f.battle_school.armies.iter().enumerate().map(|(i, a)| army(p, i, a)).collect()
    };
    let stamp = if f.masked { format!("fixture, masked · {}", f.generated_at) } else { format!("live · {}", f.generated_at) };
    col().key("window").role("window").w_full().h_full().fill(t.bg)
        .child(col().key("page").w_full().grow(1.0).min_h(0.0).px(space::S6).pt(space::S6).gap(space::S3)
            .child(col().key("head").gap(2.0).ml(space::S3)
                .child(text("Battle school").key("title").font(TextStyle::new(24.0, 700.0)).color(t.text))
                .child(text("✦BEAN's client work: one army per client, seven toons each (A read, B write, C analysis, D creative, E tracking, F comms, G access)")
                    .key("subtitle").font(type_::BODY).color(t.text_secondary)))
            .child(col().key("armies").w_full().grow(1.0).min_h(0.0).gap(space::S6).pb(space::S3)
                .scroll(ScrollSpec { stick_bottom: false }).scroll_edge_fade(16.0)
                .children(armies)))
        .child(row().key("foot").w_full().h(32.0).px(space::S6).center_y().justify_between()
            .child(text("justingriffiths.com/fleet/battle-school/").key("where").font(type_::LABEL).color(t.text_secondary))
            .child(text(stamp).key("stamp").font(type_::LABEL).color(t.text_secondary)))
}

pub fn spec() -> AppSpec<State> {
    let mut s = AppSpec::new("Battle school", SIZE, State::default, view);
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
    fn fixture_is_masked_and_has_seven_toons() {
        let f = fixture();
        assert!(f.masked);
        let a = &f.battle_school.armies[0];
        assert_eq!(a.name, "Client A");
        assert_eq!(a.toons.len(), 7);
        assert!(!a.connections.is_empty());
    }

    #[test]
    fn probed_names_channels_and_newest_date() {
        let f = fixture();
        let a = &f.battle_school.armies[0];
        assert_eq!(probed(a, &a.toons[0]), "meta, google, tiktok, warehouse · 11-07");
        assert_eq!(probed(a, &a.toons[1]), "meta · 11-07");
        assert_eq!(probed(a, &a.toons[5]), "no connection");
    }

    #[test]
    fn fixture_holds_no_real_client_name() {
        let raw = fleet_scene::FIXTURE.to_lowercase();
        for bad in ["urban", "moonshine", "@"] { assert!(!raw.contains(bad), "fixture leaks {bad}"); }
    }
}
