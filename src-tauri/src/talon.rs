use std::path::PathBuf;
use std::process::Command;

/// Get the path to Talon's REPL executable
pub fn get_talon_repl_path() -> Option<PathBuf> {
    let home = dirs::home_dir()?;
    let repl_path = home.join(".talon/bin/repl");
    if repl_path.exists() {
        Some(repl_path)
    } else {
        None
    }
}

/// Check if Talon Voice is installed
pub fn is_talon_installed() -> bool {
    get_talon_repl_path().is_some()
}

/// Execute a Talon command via the REPL
///
/// # Arguments
/// * `code` - Python code to execute in the Talon REPL
///
/// # Examples
/// ```
/// execute_talon("actions.key('cmd-s')") // Send Cmd+S
/// execute_talon("actions.insert('hello')") // Type 'hello'
/// execute_talon("actions.mimic('focus chrome')") // Run voice command
/// ```
pub fn execute_talon(code: &str) -> Result<String, String> {
    let repl_path = get_talon_repl_path()
        .ok_or_else(|| "Talon Voice is not installed. Install from https://talonvoice.com".to_string())?;

    // Escape single quotes in the code
    let escaped_code = code.replace('\'', "'\\''");

    let output = Command::new("sh")
        .arg("-c")
        .arg(format!("echo '{}' | '{}'", escaped_code, repl_path.display()))
        .output()
        .map_err(|e| format!("Failed to execute Talon command: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.is_empty() {
            Err("Talon command failed with no error message".to_string())
        } else {
            Err(stderr.trim().to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_talon_detection() {
        // This test will pass if Talon is installed, skip gracefully if not
        let installed = is_talon_installed();
        println!("Talon installed: {}", installed);
    }
}
