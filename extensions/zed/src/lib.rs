use std::path::Path;
use zed_extension_api as zed;

struct MeowterExtension;

impl zed::Extension for MeowterExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        _: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> zed::Result<zed::Command> {
        let root = worktree.root_path();
        let server_path = format!("{root}/packages/meowter-lsp/dist/server.js");

        // Skip activation in non-meowter workspaces. Zed binds this
        // extension to HTML/TS globally, so without this check it
        // tries to spawn in every project that has those file types.
        if !Path::new(&server_path).exists() {
            return Err(format!(
                "meowter-lsp not found at {server_path} (not a meowter workspace)"
            ));
        }

        // `command` is resolved relative to Zed's extension work
        // directory unless it's an absolute path. Use the worktree's
        // PATH lookup so users with proto/nvm/asdf node installs work.
        let node = worktree
            .which("node")
            .ok_or_else(|| "`node` not found on $PATH".to_string())?;

        Ok(zed::Command {
            command: node,
            args: vec![server_path, "--stdio".to_string()],
            env: vec![("MEOWTER_LSP_LOG".to_string(), "1".to_string())],
        })
    }
}

zed::register_extension!(MeowterExtension);
