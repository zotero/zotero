preferences-window =
    .title = Configurações do { -app-name }
preferences-appearance-title = Aparência e Idioma
preferences-auto-recognize-files =
    .label = Extrair metadados de PDFs e e-books automaticamente
preferences-file-renaming-title = Renomeação do arquivo
preferences-file-renaming-intro = { -app-name } pode renomear arquivos automaticamente a partir dos detalhes do item pai (título, autor, etc.) e manter o nome do arquivo sincronizado durante as mudanças. Arquivos baixados são sempre nomeados inicialmente com base nos detalhes do item pai.
preferences-file-renaming-configure-button =
    .label = Configure File Renaming…
preferences-attachment-titles-title = Títulos de anexos
preferences-attachment-titles-intro = Os títulos dos anexos estão <label data-l10n-name="wiki-link">diferentes dos títulos dos arquivos</label>. Para alguns recursos, { -app-name } pode mostrar o nome do arquivo ao invés do título do anexo na lista de itens.
preferences-attachment-titles-show-filenames =
    .label = Mostrar títulos de anexos na lista de itens
preferences-reader-title = Leitor
preferences-reader-open-epubs-using = Abrir EPUBs usando
preferences-reader-open-snapshots-using = Abrir snapshots usando
preferences-reader-open-in-new-window =
    .label = Abrir arquivos em novas janelas ao invés de abas
preferences-reader-auto-disable-tool =
    .label = Desligar ferramentas de anotação de nota, texto e imagem a cada uso
preferences-reader-ebook-font = Fonte do e-book:
preferences-reader-ebook-hyphenate =
    .label = Ativar a hifenação automática:
preferences-note-title = Notas
preferences-note-open-in-new-window =
    .label = Abrir notas em novas janelas ao invés de abas
preferences-color-scheme = Esquema de cor:
preferences-color-scheme-auto =
    .label = Automático(a)
preferences-color-scheme-light =
    .label = Claro
preferences-color-scheme-dark =
    .label = Escuro
preferences-item-pane-header = Cabeçalho do painel de item:
preferences-item-pane-header-style = Estilo de citação do cabeçalho:
preferences-item-pane-header-locale = Idioma do cabeçalho:
preferences-item-pane-header-missing-style = Estilo faltante: <{ $shortName }>
preferences-locate-library-lookup-intro = Library Lookup pode encontrar um recurso on-line utilizando o OpenURL resolvedor da sua biblioteca.
preferences-locate-resolver = Resolvedor:
preferences-locate-base-url = URL da base:
preferences-quickCopy-minus =
    .aria-label = { general-remove }
    .label = { $label }
preferences-quickCopy-plus =
    .aria-label = { general-add }
    .label = { $label }
preferences-styleManager-intro = { -app-name } pode gerar citações e referências em mais de 10.000 estilos de citação. Adicione estilos aqui para que estejam disponíveis para seleção em todo { -app-name }.
preferences-styleManager-get-additional-styles =
    .label = Obter estilos adicionais...
preferences-styleManager-restore-default =
    .label = Restaurar estilos padrão...
preferences-styleManager-add-from-file =
    .tooltiptext = Adicionar estilo de arquivo
    .label = Adicionar a partir de arquivo...
preferences-styleManager-remove = Pressione { delete-or-backspace } para remover este estilo.
preferences-citation-dialog = Caixa de citação
preferences-citation-dialog-mode = Modo de caixa de citação:
preferences-citation-dialog-mode-last-used =
    .label = Último uso
preferences-citation-dialog-mode-list =
    .label = Modo de lista
preferences-citation-dialog-mode-library =
    .label = Modo biblioteca
preferences-advanced-enable-local-api =
    .label = Permitir que outros aplicativos neste computador se comuniquem com o { -app-name }
preferences-advanced-local-api-available = Disponível em <code data-l10n-name="url">{ $url }</span>
preferences-advanced-server-disabled = O servidor HTTP de { -app-name } está desativado.
preferences-advanced-server-enable-and-restart =
    .label = Ativar e Reiniciar
preferences-advanced-language-and-region-title = Idioma e Região
preferences-advanced-enable-bidi-ui =
    .label = Habilitar funções de edição de texto bidirecional
preferences-advanced-reset-data-dir =
    .label = Reverta para localização padrão...
preferences-advanced-custom-data-dir =
    .label = Usar Localização Personalizada
preferences-advanced-default-data-dir =
    .value = (Padrão: { $directory })
    .aria-label = Localização predefinida
-preferences-sync-data-syncing = Sincronização de dados
preferences-sync-data-syncing-groupbox =
    .aria-label = { -preferences-sync-data-syncing }
preferences-sync-data-syncing-heading = { -preferences-sync-data-syncing }
preferences-sync-data-syncing-description = Log in with your { -app-name } account to sync your data between devices, collaborate with others, and more.
preferences-account-log-out =
    .label = Log Out…
preferences-sync-reset-restore-to-server-body = { -app-name } substituirá “{ $libraryName }” em { $domain } com dados deste computador.
preferences-sync-reset-restore-to-server-deleted-items-text =
    { $remoteItemsDeletedCount } { $remoteItemsDeletedCount ->
        [one] item na biblioteca online será excluído
       *[other] itens na biblioteca online serão excluídos
    } permanentemente.
preferences-sync-reset-restore-to-server-remaining-items-text =
    { general-sentence-separator }{ $localItemsCount ->
        [0] A biblioteca neste computador e a biblioteca online serão esvaziadas.
        [one] 1 item permanecerá neste computador e na biblioteca online.
       *[other] { $localItemsCount } itens permanecerão neste computador e na biblioteca online.
    }
preferences-sync-reset-restore-to-server-checkbox-label =
    { $remoteItemsDeletedCount ->
        [one] Excluir 1 item
        [many] Excluir { $remoteItemsDeletedCount } itens
       *[other] Excluir { $remoteItemsDeletedCount } itens
    }
preferences-sync-reset-restore-to-server-confirmation-text = excluir biblioteca online
preferences-sync-reset-restore-to-server-yes = Substituir dados na Biblioteca Online
preferences-account-log-in =
    .label = Log In
preferences-account-waiting-for-login =
    .value = Waiting for login…
preferences-account-cancel-button =
    .label = { general-cancel }
preferences-account-logged-out-status =
    .value = (logged out)
preferences-account-email-label =
    .value = Email:
preferences-account-switch-accounts =
    .label = Switch Accounts…
preferences-account-switch-text = Switching to a different account will remove all { -app-name } data on this computer. Before continuing, make sure all data and files you wish to keep have been synced with the “{ $username }” account or you have a backup of your { -app-name } data directory.
preferences-account-switch-confirmation-text = remove local data
preferences-account-switch-accept = Remove Data and Restart
