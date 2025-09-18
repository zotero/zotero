integration-docPrefs-window =
    .title = { -app-name } - Preferências do documento
integration-addEditCitation-window =
    .title = { -app-name } - Adicionar/Editar citação
integration-editBibliography-window =
    .title = { -app-name } - Editar bibliografia
integration-editBibliography-add-button =
    .aria-label = { general-add }
integration-editBibliography-remove-button =
    .aria-label = { general-remove }
integration-editBibliography-editor =
    .aria-label = Editar referência
-integration-editBibliography-include-uncited = Para incluir um item novo em sua bibliografia, selecione o item da lista e pressione { general-add }.
-integration-editBibliography-exclude-cited = Você também pode excluir um item citado selecionando o item da lista de referências e pressionando { general-remove }.
-integration-editBibliography-edit-reference = Para alterar a formatação de uma referência, use o editor de texto.
integration-editBibliography-wrapper =
    .aria-label = Janela de edição de bibliografia
    .aria-description =
        { -integration-editBibliography-include-uncited }
        { -integration-editBibliography-exclude-cited }
        { -integration-editBibliography-edit-reference }
integration-citationDialog = Citation Dialog
integration-citationDialog-section-open = Abrir documentos ({ $count })
integration-citationDialog-section-selected = Selected Items ({ $count }/{ $total })
integration-citationDialog-section-cited =
    { $count ->
        [0] Cited Items
       *[other] Cited Items ({ $count })
    }
integration-citationDialog-details-suffix = Sufixo
integration-citationDialog-details-prefix = Prefixo
integration-citationDialog-details-suppressAuthor = Omitir autor
integration-citationDialog-details-remove = { general-remove }
integration-citationDialog-details-done =
    .label = { general-done }
integration-citationDialog-details-showInLibrary = { general-show-in-library }
integration-citationDialog-settings-title = Configurações de citação
integration-citationDialog-lib-no-items =
    { $search ->
        [true] No selected, open, or cited items match the current search
       *[other] No selected or open items
    }
integration-citationDialog-settings-keepSorted = Keep sources sorted
integration-citationDialog-btn-settings =
    .title = { general-open-settings }
integration-citationDialog-btn-mode =
    .title =
        { $mode ->
            [library] Switch to List Mode
            [list] Switch to Library Mode
           *[other] Switch Mode
        }
    .aria-label =
        { $mode ->
            [library] The dialog is in Library mode. Click to switch to List Mode.
            [list] The dialog is in List mode. Click to switch to Library Mode.
           *[other] Switch Mode
        }
integration-citationDialog-btn-accept =
    .title = { general-accept }
integration-citationDialog-btn-cancel =
    .title = { general-cancel }
integration-citationDialog-general-instructions = Use Left/Right-Arrow to navigate the items of this citation. Press Tab to select items to add to this citation.
integration-citationDialog-enter-to-add-item = Pressione { return-or-enter } para adicionar este item à coleção.
integration-citationDialog-search-for-items = Buscar itens para adicionar à citação
integration-citationDialog-aria-bubble =
    .aria-description = This item is included in the citation. Press space bar to customize the item. { integration-citationDialog-general-instructions }
integration-citationDialog-single-input =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = Press Tab to select items to add to this citation. Press Escape to discard the changes and close the dialog.
integration-citationDialog-input =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-aria-item-list =
    .aria-description = Use Up/Down Arrow to change item selection. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-aria-item-library =
    .aria-description = Use Right/Left Arrow to change item selection. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-collections-table =
    .aria-label = Coleções.
    .aria-description = Select a collection and press Tab to navigate its items.
integration-citationDialog-items-table =
    .aria-label = { integration-citationDialog-enter-to-add-item }
integration-citationDialog-items-table-added =
    .aria-label = This item has been added to the citation. Press { return-or-enter } to add it again or { delete-or-backspace } to remove it.
integration-citationDialog-add-all = Add all
integration-citationDialog-collapse-section =
    .title = Comprimir seção
integration-citationDialog-bubble-empty = (no title)
integration-citationDialog-add-to-citation = Add to Citation
integration-prefs-displayAs-label = Exibir citações como:
integration-prefs-footnotes =
    .label = Notas de rodapé
integration-prefs-endnotes =
    .label = Notas de fim
integration-prefs-bookmarks =
    .label = Guardar citações como marcadores
integration-prefs-bookmarks-description = Os marcadores podem ser compartilhados entre o Word e o LibreOffice, mas podem causar erros caso sejam modificados acidentalmente e não podem ser inserido nas notas de rodapé.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] o documento deve ser salvo como .doc ou .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Atualizar citações automaticamente
    .tooltip = Citações com atualizações pendentes serão destacadas no documento
integration-prefs-automaticCitationUpdates-description = Desativar atualizações acelera a inserção de citação em documentos grandes. Clique em Refresh para atualizar citações manualmente.
integration-prefs-automaticJournalAbbeviations =
    .label = Usar as abreviaturas de periódicos MEDLINE
integration-prefs-automaticJournalAbbeviations-description = O campo "Abreviatura do periódico" será ignorado.
integration-prefs-exportDocument =
    .label = Trocar para um Editor de Texto diferente...
integration-error-unable-to-find-winword = { -app-name } não conseguiu encontrar uma instância do Word em execução.
integration-warning-citation-changes-will-be-lost = You have made changes to a citation that will be lost if you continue.
integration-warning-bibliography-changes-will-be-lost = You have made changes to the bibliography that will be lost if you continue.
integration-warning-documentPreferences-changes-will-be-lost = You have made changes to the document preferences that will be lost if you continue.
integration-warning-discard-changes = Discard Changes
integration-warning-command-is-running = A word processor integration command is already running.
