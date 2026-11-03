use super::*;

#[test]
fn refresh_submitted_after_force_waits_for_the_replacement() {
    let coordinator = ScanCoordinator::<u32>::default();
    let Submission::Start { job, receiver } = coordinator.submit(SyncRequest::Refresh, true) else {
        panic!("refresh should start");
    };
    let first = receiver.unwrap();
    let Submission::Wait(force) = coordinator.submit(SyncRequest::Force, true) else {
        panic!("force should wait");
    };
    let Submission::Wait(latest) = coordinator.submit(SyncRequest::Refresh, true) else {
        panic!("latest refresh should wait");
    };

    assert!(job.cancelled.load(Ordering::Relaxed));
    let replacement = coordinator
        .complete(job, Err(AppError::ScanCancelled))
        .unwrap();

    assert_eq!(replacement.request, SyncRequest::Force);
    assert!(!replacement.cancelled.load(Ordering::Relaxed));
    assert_eq!(first.try_recv(), Err(mpsc::TryRecvError::Empty));
    assert_eq!(force.try_recv(), Err(mpsc::TryRecvError::Empty));
    assert_eq!(latest.try_recv(), Err(mpsc::TryRecvError::Empty));
    assert!(coordinator.complete(replacement, Ok(9)).is_none());
    assert_eq!(first.recv().unwrap(), Ok(9));
    assert_eq!(force.recv().unwrap(), Ok(9));
    assert_eq!(latest.recv().unwrap(), Ok(9));
}

#[test]
fn immediate_retry_after_cancel_all_starts_a_fresh_scan() {
    let coordinator = ScanCoordinator::<u32>::default();
    let Submission::Start { job, receiver } = coordinator.submit(SyncRequest::Force, true) else {
        panic!("force should start");
    };
    let cancelled = receiver.unwrap();
    coordinator.cancel_all();
    let Submission::Wait(retry) = coordinator.submit(SyncRequest::Refresh, true) else {
        panic!("retry should wait for cancellation cleanup");
    };

    let replacement = coordinator.complete(job, Err(AppError::ScanCancelled));

    assert_eq!(cancelled.recv().unwrap(), Err(AppError::ScanCancelled));
    assert_eq!(retry.try_recv(), Err(mpsc::TryRecvError::Empty));
    let replacement = replacement.expect("retry should start a replacement scan");
    assert_eq!(replacement.request, SyncRequest::Refresh);
    assert!(!replacement.cancelled.load(Ordering::Relaxed));
    assert!(coordinator.complete(replacement, Ok(11)).is_none());
    assert_eq!(retry.recv().unwrap(), Ok(11));
}
