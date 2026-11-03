use super::*;
use crate::catalog::sync::{app, compute_delta};

#[test]
fn unchanged_catalog_publishes_the_committed_generation() {
    let apps = vec![app("editor", "Editor")];
    let outcome = super::super::commit::ScanOutcome {
        delta: compute_delta(8, &apps, &apps),
        apps,
        generation: 8,
        diagnostics: None,
    };
    let mut events = Vec::new();

    let commit = publish_catalog(outcome, |delta| {
        events.push(serde_json::to_value(delta).unwrap());
    });

    assert_eq!(commit.generation, 8);
    assert_eq!(commit.apps.len(), 1);
    assert_eq!(events.len(), 1);
    assert_eq!(events[0]["generation"], 8);
    assert_eq!(events[0]["upserted"], serde_json::json!([]));
    assert_eq!(events[0]["removedIds"], serde_json::json!([]));
    assert_eq!(
        events[0]["summary"],
        serde_json::json!({
            "added": 0, "removed": 0, "updated": 0
        })
    );
}

#[test]
fn empty_catalog_publishes_each_new_generation() {
    let mut generations = Vec::new();
    for generation in [8, 9] {
        let outcome = super::super::commit::ScanOutcome {
            delta: compute_delta(generation, &[], &[]),
            apps: Vec::new(),
            generation,
            diagnostics: None,
        };

        publish_catalog(outcome, |delta| {
            generations.push(serde_json::to_value(delta).unwrap()["generation"].clone());
        });
    }

    assert_eq!(
        generations,
        vec![serde_json::json!(8), serde_json::json!(9)]
    );
}
