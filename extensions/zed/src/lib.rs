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
        Ok(zed::Command {
            command: "node".to_string(),
            args: vec![server_path, "--stdio".to_string()],
            env: vec![("MEOWTER_LSP_LOG".to_string(), "1".to_string())],
        })
    }
}

zed::register_extension!(MeowterExtension);
