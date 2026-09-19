use std::process::Child;
use std::time::{Duration, Instant};

#[cfg(windows)]
use std::os::windows::io::{AsRawHandle, RawHandle};

#[cfg(windows)]
#[allow(non_camel_case_types, non_upper_case_globals)]
mod win32 {
    use super::*;

    #[allow(clippy::upper_case_acronyms)]
    type BOOL = i32;
    #[allow(clippy::upper_case_acronyms)]
    type HANDLE = RawHandle;
    #[allow(clippy::upper_case_acronyms)]
    type DWORD = u32;
    #[allow(clippy::upper_case_acronyms)]
    type SIZE_T = usize;
    #[allow(clippy::upper_case_acronyms)]
    type ULONG_PTR = usize;

    const JobObjectExtendedLimitInformation: DWORD = 9;
    const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE: DWORD = 0x00002000;

    #[repr(C)]
    struct IO_COUNTERS {
        read_operation_count: u64,
        write_operation_count: u64,
        other_operation_count: u64,
        read_transfer_count: u64,
        write_transfer_count: u64,
        other_transfer_count: u64,
    }

    #[repr(C)]
    struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
        per_process_user_time_limit: i64,
        per_job_user_time_limit: i64,
        limit_flags: DWORD,
        minimum_working_set_size: SIZE_T,
        maximum_working_set_size: SIZE_T,
        active_process_limit: DWORD,
        affinity: ULONG_PTR,
        priority_class: DWORD,
        scheduling_class: DWORD,
    }

    #[repr(C)]
    struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
        basic_limit_information: JOBOBJECT_BASIC_LIMIT_INFORMATION,
        io_info: IO_COUNTERS,
        process_memory_limit: SIZE_T,
        job_memory_limit: SIZE_T,
        peak_process_memory_used: SIZE_T,
        peak_job_memory_used: SIZE_T,
    }

    extern "system" {
        fn CreateJobObjectW(
            lp_job_attributes: *mut std::ffi::c_void,
            lp_name: *const u16,
        ) -> HANDLE;
        fn SetInformationJobObject(
            h_job: HANDLE,
            job_object_info_class: DWORD,
            lp_job_object_info: *const std::ffi::c_void,
            cb_job_object_info_length: DWORD,
        ) -> BOOL;
        fn AssignProcessToJobObject(h_job: HANDLE, h_process: HANDLE) -> BOOL;
        fn TerminateJobObject(h_job: HANDLE, u_exit_code: u32) -> BOOL;
        fn CloseHandle(h_object: HANDLE) -> BOOL;
    }

    pub struct WinJobObject {
        handle: HANDLE,
    }

    // HANDLE is safe to send between threads
    unsafe impl Send for WinJobObject {}
    unsafe impl Sync for WinJobObject {}

    impl WinJobObject {
        pub fn create() -> Option<Self> {
            unsafe {
                let handle = CreateJobObjectW(std::ptr::null_mut(), std::ptr::null());
                if handle.is_null() {
                    return None;
                }

                let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
                info.basic_limit_information.limit_flags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

                let ok = SetInformationJobObject(
                    handle,
                    JobObjectExtendedLimitInformation,
                    &info as *const _ as *const std::ffi::c_void,
                    std::mem::size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as DWORD,
                );

                if ok == 0 {
                    CloseHandle(handle);
                    return None;
                }

                Some(Self { handle })
            }
        }

        pub fn assign_process(&self, process_handle: HANDLE) -> bool {
            unsafe { AssignProcessToJobObject(self.handle, process_handle) != 0 }
        }

        pub fn terminate(&self, exit_code: u32) -> bool {
            unsafe { TerminateJobObject(self.handle, exit_code) != 0 }
        }
    }

    impl Drop for WinJobObject {
        fn drop(&mut self) {
            unsafe {
                if !self.handle.is_null() {
                    CloseHandle(self.handle);
                }
            }
        }
    }
}

pub struct ProcessContainment {
    #[cfg(windows)]
    job: Option<win32::WinJobObject>,
}

impl ProcessContainment {
    pub fn new() -> Self {
        #[cfg(windows)]
        {
            Self {
                job: win32::WinJobObject::create(),
            }
        }
        #[cfg(not(windows))]
        {
            Self {}
        }
    }

    pub fn assign(&self, child: &Child) -> bool {
        #[cfg(windows)]
        {
            if let Some(ref job) = self.job {
                job.assign_process(child.as_raw_handle())
            } else {
                false
            }
        }
        #[cfg(not(windows))]
        {
            let _ = child;
            true
        }
    }

    pub fn terminate(&self) -> bool {
        #[cfg(windows)]
        {
            if let Some(ref job) = self.job {
                job.terminate(1)
            } else {
                false
            }
        }
        #[cfg(not(windows))]
        {
            false
        }
    }
}

impl Default for ProcessContainment {
    fn default() -> Self {
        Self::new()
    }
}

/// Helper function to perform bounded graceful shutdown followed by force-kill if needed.
pub fn shutdown_child_bounded(
    child: &mut Child,
    timeout: Duration,
    containment: Option<&ProcessContainment>,
) {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        match child.try_wait() {
            Ok(Some(_)) => return,
            Ok(None) => std::thread::sleep(Duration::from_millis(20)),
            Err(_) => break,
        }
    }

    // Force termination of containment job object or child
    if let Some(cont) = containment {
        cont.terminate();
    }
    let _ = child.kill();
    let _ = child.wait();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_process_containment_lifecycle() {
        let containment = ProcessContainment::new();
        #[cfg(windows)]
        assert!(
            containment.job.is_some(),
            "Job object should be successfully created on Windows"
        );

        // Spawn a short-lived process and assign to containment
        let mut cmd = if cfg!(windows) {
            let mut c = std::process::Command::new("cmd.exe");
            c.args(["/C", "ping 127.0.0.1 -n 2 > nul"]);
            c
        } else {
            let mut c = std::process::Command::new("sleep");
            c.arg("1");
            c
        };

        if let Ok(mut child) = cmd.spawn() {
            let assigned = containment.assign(&child);
            assert!(assigned, "Child should be assigned to containment");
            shutdown_child_bounded(&mut child, Duration::from_millis(100), Some(&containment));
            assert!(
                child.try_wait().unwrap().is_some(),
                "Child should be terminated"
            );
        }
    }
}
