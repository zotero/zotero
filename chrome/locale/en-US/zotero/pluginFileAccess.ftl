plugin-file-access-window =
    .title = Plugin file access request

plugin-file-access-title = Plugin file access request

plugin-file-access-headline = "{ $pluginName }" wants to { $action ->
    [write] modify
   *[read] read
    } { $type ->
    [file] file
    *[folder] folder
    } { $hasDirectory ->
    [yes] <code data-l10n-name="file-name">{ $fileName }</code> in directory <code data-l10n-name="dir-name">{ $directoryName }</code>
   *[no] <code data-l10n-name="file-name">{ $fileName }</code>
    }

plugin-file-access-remember =
    .label = Remember this decision

plugin-file-access-deny =
    .label = Deny

plugin-file-access-allow =
    .label = Allow

plugin-file-access-allow-always =
    .label = Always allow

plugin-file-access-allow-folder =
    .label = Allow for the directory

plugin-file-access-allow-folder-always =
    .label = Always allow for the directory
