preferences-window =
    .title = Configurações do { -app-name }
preferences-appearance-title = Aparência e Idioma
preferences-auto-recognize-files =
    .label = Extrair metadados de PDFs e e-books automaticamente
preferences-file-renaming-title = Renomeação do arquivo
preferences-file-renaming-intro = { -app-name } pode renomear arquivos automaticamente a partir dos detalhes do item pai (título, autor, etc.) e manter o nome do arquivo sincronizado durante as mudanças. Arquivos baixados são sempre nomeados inicialmente com base nos detalhes do item pai.
preferences-file-renaming-auto-rename-files =
    .label = Renomear arquivos automaticamente
preferences-file-renaming-file-types = Renomear arquivos destes tipos:
preferences-file-renaming-file-type-pdf =
    .label = { file-type-pdf }
preferences-file-renaming-file-type-epub =
    .label = { file-type-ebook }
preferences-file-renaming-file-type-image =
    .label = { file-type-image }
preferences-file-renaming-file-type-audio =
    .label = { file-type-audio }
preferences-file-renaming-file-type-video =
    .label = { file-type-video }
preferences-file-renaming-customize-button =
    .label = Customizar formato do nome do arquivo...
preferences-file-renaming-rename-now =
    .label = Renomear arquivos...
preferences-file-renaming-format-title = Formato do nome do arquivo
preferences-file-renaming-format-instructions = Você pode customizar o padrão de nome de arquivo usado pelo { -app-name } para renomear os arquivos anexados a partir do metadado do item pai.
preferences-file-renaming-format-instructions-example = Por exemplo, neste modelo “{ $example }” será substituído pelo título do item pai, limitado a 50 caracteres.
preferences-file-renaming-format-instructions-more = Ver a <label data-l10n-name="file-renaming-format-help-link">documentação</label> para mais informações.
preferences-file-renaming-format-template = Modelo do nome do arquivo:
preferences-file-renaming-format-preview = Visualização:
preferences-attachment-titles-title = Attachment Titles
preferences-attachment-titles-intro = Attachment titles are <label data-l10n-name="wiki-link">different from filenames</label>. To support some workflows, { -app-name } can show filenames instead of attachment titles in the items list.
preferences-attachment-titles-show-filenames =
    .label = Show attachment filenames in the items list
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
    .label = Open notes in new windows instead of tabs
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
