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
integration-citationDialog = Caixa de citação
integration-citationDialog-section-open = Abrir documentos ({ $count })
integration-citationDialog-section-selected = Itens Selecionados ({ $count }/{ $total })
integration-citationDialog-section-cited =
    { $count ->
        [0] Itens citados
       *[other] Itens citados ({ $count })
    }
integration-citationDialog-details-suffix = Sufixo
integration-citationDialog-details-prefix = Prefixo
integration-citationDialog-details-suppressAuthor = Omitir Autor
integration-citationDialog-details-remove = { general-remove }
integration-citationDialog-details-done =
    .label = { general-done }
integration-citationDialog-details-showInLibrary = { general-show-in-library }
integration-citationDialog-settings-title = Configurações de citação
integration-citationDialog-lib-message-citation =
    { $search ->
        [true] Nenum item selecionado, aberto ou citado corresponde a busca
       *[other] Nenhum item selecionado ou aberto
    }
integration-citationDialog-lib-message-add-note =
    { $search ->
        [true] Nenhuma nota selecionada corresponde a busca
       *[other] Nenhuma nota selecionada
    }
integration-citationDialog-settings-keepSorted = Manter as fontes ordenadas
integration-citationDialog-btn-settings =
    .title = { general-open-settings }
integration-citationDialog-mode-library = Biblioteca
integration-citationDialog-mode-list = Lista
integration-citationDialog-btn-type-citation =
    .title = Adicionar/Editar Citação
integration-citationDialog-btn-type-add-note =
    .title = Adicionar Nota
integration-citationDialog-btn-accept =
    .title = { general-accept }
integration-citationDialog-btn-cancel =
    .title = { general-cancel }
integration-citationDialog-general-instructions = Use as setas direcionais direita/esquerda para navegar entre itens desta citação. Pressione Tab para selecionar itens e adicionar a esta citação.
integration-citationDialog-enter-to-add-item = Pressione { return-or-enter } para adicionar este item à coleção.
integration-citationDialog-search-for-items = Buscar itens para adicionar à citação
integration-citationDialog-aria-bubble =
    .aria-description = Este item está incluído na citação. Pressione a barra de espaço para customizar o item. { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = Pressione Tab para selecionar itens e adicionar a esta citação. Pressione Escape para descartar as alterações e fechar a caixa.
integration-citationDialog-input-citation =
    .placeholder = { integration-citationDialog-search-for-items }
    .aria-description = { integration-citationDialog-general-instructions }
integration-citationDialog-single-input-add-note =
    .placeholder = Busque por nota para inserir no documento
integration-citationDialog-aria-item-list =
    .aria-description = Utilize as setas direcionais para cima/para baixo para mudar a seleção. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-aria-item-library =
    .aria-description = Utilize as setas direcionais direita/esquerda para mudar a seleção. { integration-citationDialog-enter-to-add-item }
integration-citationDialog-collections-table =
    .aria-label = Coleções.
    .aria-description = Selecione uma coleção e pressione Tab para navegar entre seus itens.
integration-citationDialog-items-table =
    .aria-label = { integration-citationDialog-enter-to-add-item }
integration-citationDialog-items-table-added =
    .aria-label = Este item foi adicionado a citação. Pressione { return-or-enter } para adicioná-lo novamente ou { delete-or-backspace } para removê-lo.
integration-citationDialog-add-all = Adicionar tudo
integration-citationDialog-collapse-section =
    .title = Comprimir seção
integration-citationDialog-bubble-empty = (sem título)
integration-citationDialog-add-to-citation = Adicionar citação
integration-prefs-displayAs-label = Mostrar Citações Como:
integration-prefs-footnotes =
    .label = Notas de pé-de-página
integration-prefs-endnotes =
    .label = Notas finais
integration-prefs-bookmarks =
    .label = Guardar citações como marcadores
integration-prefs-bookmarks-description = Os marcadores podem ser partilhados entre o Word e o LibreOffice, mas podem causar erros se forem acidentalmente modificados e não podem ser inseridos em notas de rodapé.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] o documento deve ser salvo como .doc ou .docx.
       *[other] { "" }
    }
integration-prefs-automaticCitationUpdates =
    .label = Actualizar citações automaticamente
    .tooltip = Citações com actualizações pendentes serão destacadas no documento
integration-prefs-automaticCitationUpdates-description = Desactivar actualizações pode acelerar a inserção de citações em documentos grandes. Clique em Refrescar para actualizar as citações manualmente.
integration-prefs-automaticJournalAbbeviations =
    .label = Usar abreviaturas de publicações periódicas do MEDLINE
integration-prefs-automaticJournalAbbeviations-description = O campo «Abreviatura da Publicação» será ignorado.
integration-prefs-exportDocument =
    .label = Mudar para um Processador de Texto Diferente...
integration-error-unable-to-find-winword = { -app-name } não conseguiu encontrar uma instância do Word em execução.
integration-warning-citation-changes-will-be-lost = Você fez alterações na citação que serão perdidas se você continuar.
integration-warning-bibliography-changes-will-be-lost = Você fez alterações na bibliografia que serão perdidas se você continuar.
integration-warning-documentPreferences-changes-will-be-lost = Você fez alterações nas preferências do documento que serão perdidas se você continuar.
integration-warning-discard-changes = Descartar alterações
integration-warning-command-is-running = Um comando de integração de processador de texto já está em funcionamento.
first-run-guidance-citationDialog =
    Digite um título, autor e/ou ano para buscar por uma referência.
    
    Depois que tiver feito sua seleção, clique no balão e selecione pelo teclado e pressione ↓/Espaço para mostrar as opções de citação como número de página, prefixo e sufixo.
    
    Você também pode adicionar o número da página ou outro localizador ao incluir com os termos da busca (ex.: “história { $locator }”) ou digitando depois do balão e pressionando { return-or-enter }.
