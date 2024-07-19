general-print = Imprimir
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
general-remove = Remover
general-add = Adicionar
general-remind-me-later = Lembrar-me Mais Tarde
general-choose-file = Escolher Arquivo...
general-open-settings = Abrir Configurações
general-help = Ajuda
general-tag = Tag
menu-file-show-in-finder =
    .label = Show in Finder
menu-file-show-file =
    .label = Mostrar Arquivo
menu-file-show-files =
    .label = Mostrar Arquivos
menu-print =
    .label = { general-print }
menu-density =
    .label = Densidade
add-attachment = Adicionar Anexo
new-note = Nova Nota
menu-add-by-identifier =
    .label = Adicionar por Identificador
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Adicionar Arquivo...
menu-add-standalone-linked-file-attachment =
    .label = Adicionar link para Arquivo...
menu-add-child-file-attachment =
    .label = Anexar Arquivo
menu-add-child-linked-file-attachment =
    .label = Anexar Ligação a Arquivo...
menu-add-child-linked-url-attachment =
    .label = Anexar link para página...
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Nova Nota Isolada
menu-new-item-note =
    .label = Novo item Nota
menu-restoreToLibrary =
    .label = Restaurar para a Biblioteca
menu-deletePermanently =
    .label = Eliminar Permanentemente...
menu-tools-plugins =
    .label = Extensões
main-window-command =
    .label = { -app-name }
zotero-toolbar-tabs-menu =
    .tooltiptext = Listar todas as abas
filter-collections = Filtrar Coleções
zotero-collections-search =
    .placeholder = { filter-collections }
zotero-collections-search-btn =
    .tooltiptext = { filter-collections }
zotero-tabs-menu-filter =
    .placeholder = Buscar abas
zotero-tabs-menu-close-button =
    .title = Fechar aba
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Renomear coleção
collections-menu-edit-saved-search =
    .label = Editar Procura Guardada
item-creator-moveDown =
    .label = Mover Para Baixo
item-creator-moveToTop =
    .label = Mover para o Topo
item-creator-moveUp =
    .label = Mover Para Cima
item-menu-viewAttachment =
    .label =
        Open { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] Snapshot
                   *[other] Attachment
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDFs
                    [epub] EPUBs
                    [snapshot] Snapshots
                   *[other] Attachments
                }
        } { $openIn ->
            [tab] in New Tab
            [window] in New Window
           *[other] { "" }
        }
item-menu-add-file =
    .label = Ficheiro
item-menu-add-linked-file =
    .label = Arquivo relacionado
item-menu-add-url =
    .label = Web Link
view-online = Ver em Linha
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = File renamed to { $filename }
itembox-button-options =
    .tooltiptext = Abrir menu de contexto
itembox-button-merge =
    .aria-label = Selecionar versão do campo { $field }
create-parent-intro = Insira um DOI, ISBN, PMID, arXiv ID, ou ADS Bibcode para identificar este arquivo:
reader-use-dark-mode-for-content =
    .label = Usar modo escuro para o conteúdo
update-updates-found-intro-minor = Uma atualização para o { -app-name } está disponível:
update-updates-found-desc = É recomendado que você aplique esta atualização o mais breve possível.
import-window =
    .title = Importar
import-where-from = A partir de onde deseja importar?
import-online-intro-title = Introdução
import-source-file =
    .label = Um arquivo (BibTeX, RIS, Zotero RDF, etc.)
import-source-folder =
    .label = Uma pasta de PDFs ou outros arquivos
import-source-online =
    .label = Importação on-line a partir de { $targetApp }
import-options = Opções
import-importing = A importar...
import-create-collection =
    .label = Colocar as colecções e itens importados numa nova colecção
import-recreate-structure =
    .label = Recriar estrutura de pastas como coleções
import-fileTypes-header = Tipos de arquivo para importar:
import-fileTypes-pdf =
    .label = PDFs
import-fileTypes-other =
    .placeholder = Outros padrões de arquivos, separados por vírgula (ex.: *.jpg,*.png)
import-file-handling = Manipulação de Ficheiros
import-file-handling-store =
    .label = Copiar arquivos para a pasta de armazenamento do { -app-name }
import-file-handling-link =
    .label = Ligar a arquivos na localização original
import-fileHandling-description = Arquivos linkados não podem ser sincronizados pelo { -app-name }.
import-online-new =
    .label = Baixar apenas itens novos; não atualizar itens importados anteriormente
import-mendeley-username = Usuário
import-mendeley-password = Senha
general-error = Erro
file-interface-import-error = Ocorreu um erro ao tentar importar o arquivo seleccionado. Por favor assegure-se de que o arquivo é válido e tente de novo.
file-interface-import-complete = Importação Completa
file-interface-items-were-imported =
    { $numItems ->
        [0] Nenhum item foi importado
        [one] Um item foi importado
       *[other] { $numItems } itens foram importados
    }
file-interface-items-were-relinked =
    { $numRelinked ->
        [0] Nenhum item foi religado
        [one] Um item foi religado
       *[other] { $numRelinked } itens foram religados
    }
import-mendeley-encrypted = A base Mendeley selecionada não pode ser lida, possivelmente porque é criptografada. Veja <a data-l10n-name="mendeley-import-kb">Como importar biblioteca do Mendeley para o Zotero?</a> para mais informações.
file-interface-import-error-translator = Ocorreu um erro ao importar o arquivo selecionado com “{ $translator }”. Por favor, verifique se o arquivo e válido e tente novamente.
import-online-intro = No próximo passo será solicitado que faça login no { $targetAppOnline } e permita acesso ao { -app-name }. Isto é necessário para importar sua biblioteca { $targetApp } para o { -app-name }.
import-online-intro2 = { -app-name } jamais verá ou armazenará sua senha do { $targetApp }.
import-online-form-intro = Por favor, informe seus dados de login no { $targetAppOnline }. Isto é necessário para importar sua biblioteca { $targetApp } para o { -app-name }.
import-online-wrong-credentials = Login para { $targetApp } falhou. Por favor, reinsira seus dados e tente novamente.
import-online-blocked-by-plugin = A importação não pode continuar com o { $plugin } instalado. Por favor, desabilite a extensão e tente novamente.
import-online-relink-only =
    .label = Religar citações do Mendeley Desktop
import-online-relink-kb = Mais Informação
import-online-connection-error = { -app-name } não conseguiu se conectar ao { $targetApp }. Por favor, verifique sua conexão com a internet e tente novamente.
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } nota
            [many] { $count } notas
           *[other] { $count } notas
        }
report-error =
    .label = Reportar Erro...
rtfScan-wizard =
    .title = Processar RTF
rtfScan-introPage-description = { -app-name } pode extrair e reformatar citações automaticamente e inserir bibliografia em arquivos RTF. Para começar, selecione um arquivo RTF abaixo.
rtfScan-introPage-description2 = Para começar, seleccione abaixo um arquivo RTF de entrada bem como um arquivo RTF de saída:
rtfScan-input-file = Arquivo de Entrada
rtfScan-output-file = Arquivo de Saída
rtfScan-no-file-selected = Nenhum arquivo escolhido
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Selecione arquivo de entrada
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Selecione arquivo de saída
rtfScan-intro-page =
    .label = Introdução
rtfScan-scan-page =
    .label = Processando à Procura de Citações
rtfScan-scanPage-description = { -app-name } está analisando seu documento por citações. Por favor, seja paciente.
rtfScan-citations-page =
    .label = Verificar Itens Citados
rtfScan-citations-page-description = Por favor, revise a lista de citações reconhecidas para certificar-se que o { -app-name } selecionou os itens correspondentes de forma correta. Quaisquer citações não mapeadas ou ambíguas devem ser corrigidas antes de avançar para o próximo passo.
rtfScan-style-page =
    .label = Formatação do Documento
rtfScan-format-page =
    .label = Formatação das Citações
rtfScan-format-page-description = { -app-name } está processando e formatando seu arquivo RTF. Por favor, seja paciente.
rtfScan-complete-page =
    .label = Processamento RTF Completo
rtfScan-complete-page-description = O seu documento foi processado. Por favor assegure-se de que está correctamente formatado.
rtfScan-action-find-match =
    .title = Select matching item
rtfScan-action-accept-match =
    .title = Accept this match
runJS-title = Executar JavaScript
runJS-editor-label = Código:
runJS-run = Executar
runJS-help = { general-help }
runJS-result =
    { $type ->
        [async] Return value:
       *[other] Result:
    }
runJS-run-async = Executar como função assíncrona
bibliography-window =
    .title = { -app-name } - Create Citation/Bibliography
bibliography-style-label = Estilo de Citação:
bibliography-locale-label = Língua:
bibliography-displayAs-label = Display citations as:
bibliography-advancedOptions-label = Opções Avançadas
bibliography-outputMode-label = Modo de Saída:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citations
            [note] Notes
           *[other] Citations
        }
bibliography-outputMode-bibliography =
    .label = Bibliografia
bibliography-outputMethod-label = Método de Saída:
bibliography-outputMethod-saveAsRTF =
    .label = Guardar como RTF
bibliography-outputMethod-saveAsHTML =
    .label = Guardar como HTML
bibliography-outputMethod-copyToClipboard =
    .label = Copiar para a Área de Transferência
bibliography-outputMethod-print =
    .label = Imprimir
bibliography-manageStyles-label = Gerir Estilos…
integration-docPrefs-window =
    .title = { -app-name } - Document Preferences
integration-addEditCitation-window =
    .title = { -app-name } - Add/Edit Citation
integration-editBibliography-window =
    .title = { -app-name } - Edit Bibliography
integration-quickFormatDialog-window =
    .title = { -app-name } - Quick Format Citation
integration-prefs-displayAs-label = Mostrar Citações Como:
integration-prefs-footnotes =
    .label = Notas de pé-de-página
integration-prefs-endnotes =
    .label = Notas finais
integration-prefs-bookmarks =
    .label = Store citation as bookmarks
integration-prefs-bookmarks-description = Os marcadores podem ser partilhados entre o Word e o LibreOffice, mas podem causar erros se forem acidentalmente modificados e não podem ser inseridos em notas de rodapé.
integration-prefs-bookmarks-formatNotice =
    { $show ->
        [true] The document must be saved as .doc or .docx.
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
publications-intro-page =
    .label = As Minhas Publicações
publications-intro = Os itens que adiciona a As Minhas Publicações serão mostrados na sua página de perfil no zotero.org. Se escolher incluir ficheiros anexos, eles serão disponibilizados publicamente sob o licenciamento que especificar. Adicione apenas trabalho criado por si e inclua apenas ficheiros se tiver o direito de os distribuir e se o desejar fazer.
publications-include-checkbox-files =
    .label = Incluir arquivos
publications-include-checkbox-notes =
    .label = Incluir notas
publications-include-adjust-at-any-time = Pode a qualquer momento ajustar o que é mostrado da colecção As Minhas Publicações
publications-intro-authorship =
    .label = Criei esta obra.
publications-intro-authorship-files =
    .label = Criei esta obra e tenho os direitos necessários para distribuir os arquivos incluídos.
publications-sharing-page =
    .label = Escolha a forma de partilha do seu trabalho
publications-sharing-keep-rights-field =
    .label = Manter o campo de Direitos existente
publications-sharing-keep-rights-field-where-available =
    .label = Manter o campo de Direitos existente onde ele estiver disponível
publications-sharing-text = Pode reservar todos os direitos do seu trabalho, licenciá-lo sob uma licença Creative Commons ou colocá-lo no domínio público. Em qualquer dos casos, o trabalho será disponibilizado publicamente através de zotero.org.
publications-sharing-prompt = Gostaria de permitir que outros possam partilhar o seu trabalho?
publications-sharing-reserved =
    .label = Não, publique apenas o meu trabalho em zotero.org
publications-sharing-cc =
    .label = Sim, sob uma licença Creative Commons
publications-sharing-cc0 =
    .label = Sim, e ponha o meu trabalho no domínio público
publications-license-page =
    .label = Escolha uma licença Creative Commons
publications-choose-license-text = Uma licença Creative Commons permite que outros copiem e redistribuam o seu trabalho, desde que lhe dêem o devido crédito, incluam uma ligação para a licença e indiquem que alterações foram feitas. Condições adicionais podem ser especificadas mais abaixo.
publications-choose-license-adaptations-prompt = Permitir a partilha de adaptações do seu trabalho?
publications-choose-license-yes =
    .label = Sim
    .accesskey = Y
publications-choose-license-no =
    .label = Não
    .accesskey = N
publications-choose-license-sharealike =
    .label = Sim, desde que outros partilhem da mesma forma
    .accesskey = S
publications-choose-license-commercial-prompt = Permitir utilizações comerciais do seu trabalho?
publications-buttons-add-to-my-publications =
    .label = Adicionar a As Minhas Publicações
publications-buttons-next-sharing =
    .label = Próximo: Compartilhar
publications-buttons-next-choose-license =
    .label = Escolha uma Licença
licenses-cc-0 = CC0 1.0 Dedicação Universal de Domínio Público
licenses-cc-by = Licença Creative Commons Atribuição 4.0 Internacional
licenses-cc-by-nd = Licença Creative Commons Atribuição-SemDerivações 4.0 Internacional
licenses-cc-by-sa = Licença Creative Commons Atribuição-CompartilhaIgual 4.0 Internacional
licenses-cc-by-nc = Licença Creative Commons Atribuição-NãoComercial 4.0 Internacional
licenses-cc-by-nc-nd = Licença Creative Commons Atribuição-NãoComercial-SemDerivações 4.0 Internacional
licenses-cc-by-nc-sa = Licença Creative Commons Atribuição-NãoComercial-CompartilhaIgual 4.0 Internacional
licenses-cc-more-info = Certifique-se que leu as <a data-l10n-name="license-considerations">Considerações para licenças</a>do Creative Commons antes de colocar seu trabalho sob a licença CC. Saiba que a licença que você aplica não pode ser retirada, mesmo que posteriormente escolha diferentes termos ou retire a publicação do trabalho.
licenses-cc0-more-info = Certifique-se que leu as <a data-l10n-name="license-considerations">CC0 FAQ</a> do Creative Commons antes de aplicar CC0 a seu trabalho. Saiba que a colocar seu trabalho em domínio público é irreversível, mesmo que posteriormente escolha termos diferentes ou retire a publicação do trabalho.
restart-in-troubleshooting-mode-menuitem =
    .label = Reiniciar no modo de resolução de erros...
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = Reiniciar no modo de resolução de erros
restart-in-troubleshooting-mode-dialog-description = { -app-name } iniciará com todas as extensões desabilitadas. Alguns recursos podem não funcionar corretamente enquanto o modo de resolução de erros está ativo.
menu-ui-density =
    .label = Densidade
menu-ui-density-comfortable =
    .label = Confortável
menu-ui-density-compact =
    .label = Compacto
pane-info = Informação
pane-abstract = Resumo
pane-attachments = Anexos
pane-notes = Notas
pane-libraries-collections = Bibliotecas e Coleções
pane-tags = Etiquetas
pane-related = Relações
pane-attachment-info = Informação de anexo
pane-attachment-preview = Visualização
pane-attachment-annotations = Anotações
pane-header-attachment-associated =
    .label = Alterar nome do arquivo associado
section-info =
    .label = { pane-info }
section-abstract =
    .label = { pane-abstract }
section-attachments =
    .label =
        { $count ->
            [one] { $count } anexo
            [many] { $count } anexos
           *[other] { $count } anexos
        }
section-attachment-preview =
    .label = { pane-attachment-preview }
section-attachments-annotations =
    .label =
        { $count ->
            [one] { $count } anotação
            [many] { $count } anotações
           *[other] { $count } anotações
        }
section-notes =
    .label =
        { $count ->
            [one] { $count } nota
            [many] { $count } notas
           *[other] { $count } notas
        }
section-libraries-collections =
    .label = { pane-libraries-collections }
section-tags =
    .label =
        { $count ->
            [one] { $count } etiqueta
            [many] { $count } etiquetas
           *[other] { $count } etiquetas
        }
section-related =
    .label = { $count } relacionado
section-attachment-info =
    .label = { pane-attachment-info }
section-button-remove =
    .tooltiptext = { general-remove }
section-button-add =
    .tooltiptext = { general-add }
section-button-expand =
    .dynamic-tooltiptext = Expandir seção
    .label = Expand { $section } section
section-button-collapse =
    .dynamic-tooltiptext = Comprimir seção
    .label = Collapse { $section } section
annotations-count =
    { $count ->
        [one] { $count } anotação
        [many] { $count } anotações
       *[other] { $count } anotações
    }
section-button-annotations =
    .title = { annotations-count }
    .aria-label = { annotations-count }
attachment-preview =
    .aria-label = { pane-attachment-preview }
sidenav-info =
    .tooltiptext = { pane-info }
sidenav-abstract =
    .tooltiptext = { pane-abstract }
sidenav-attachments =
    .tooltiptext = { pane-attachments }
sidenav-notes =
    .tooltiptext = { pane-notes }
sidenav-attachment-info =
    .tooltiptext = { pane-attachment-info }
sidenav-attachment-preview =
    .tooltiptext = { pane-attachment-preview }
sidenav-attachment-annotations =
    .tooltiptext = { pane-attachment-annotations }
sidenav-libraries-collections =
    .tooltiptext = { pane-libraries-collections }
sidenav-tags =
    .tooltiptext = { pane-tags }
sidenav-related =
    .tooltiptext = { pane-related }
pin-section =
    .label = Fixar seção
unpin-section =
    .label = Desafixar seção
collapse-other-sections =
    .label = Comprimir outras seções
expand-all-sections =
    .label = Expandir todas seções
abstract-field =
    .placeholder = Adicionar resumo...
tag-field =
    .aria-label = { general-tag }
tagselector-search =
    .placeholder = Filtrar etiquetas
context-notes-search =
    .placeholder = Pesquisar notas
new-collection-dialog =
    .title = Nova Colecção
    .buttonlabelaccept = Criar Coleção
new-collection-name = Nome:
new-collection-create-in = Criar em:
attachment-info-filename = Nome do arquivo
attachment-info-accessed = Acedido
attachment-info-pages = Páginas
attachment-info-modified = Modificado
attachment-info-index = Indexado
attachment-info-convert-note =
    .label =
        Migrar para nota { $type ->
            [standalone] isolada
            [child] filha
           *[unknown] nova
        }
    .tooltiptext = Adicionar notas nos anexos não é mais permitido, mas você pode editar esta nota transformando em uma nota separada.
attachment-preview-placeholder = Sem anexo para visualizar
toggle-preview =
    .label =
        { $type ->
            [open] Esconder
            [collapsed] Mostrar
           *[unknown] Toggle
        } visualização de anexo
quickformat-general-instructions =
    Utilizar setas esquerda/direita para navegar pelos itens desta citação. { $dialogMenu ->
        [active] Pressione Shift-Tab para focar no menu.
       *[other] { "" }
    } Pressione { return-or-enter } para salvar edições a esta citação. Pressione Escape para descartar as mudanças e fechar a janela.
quickformat-aria-bubble = Este item está incluído na citação. Pressione a barra de espaço para customizar o item. { quickformat-general-instructions }
quickformat-aria-input = Digitar para pesquisar por um item para incluir na citação. Pressione Tab para navegar a lista de resultados de pesquisa. { quickformat-general-instructions }
quickformat-aria-item = Pressione { return-or-enter } para adicionar este item na citação. Pressione Tab para voltar para o campo de busca.
quickformat-accept =
    .tooltiptext = Salvar edições desta citação
quickformat-locator-type =
    .aria-label = Tipo de localizador
quickformat-locator-value = Localizador
quickformat-citation-options =
    .tooltiptext = Mostrar opções de citação
insert-note-aria-input = Digitar para buscar por uma nota. Pressionar Tab para navegar a lista de resultados. Pressionar Escape para fechar a janela.
insert-note-aria-item = Pressionar { return-or-enter } para selecionar esta nota. Pressionar Tab para voltar para o campo de busca. Pressionar Escape para fechar a janela.
quicksearch-mode =
    .aria-label = Modo busca rápida
quicksearch-input =
    .aria-label = Procura Rápida
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
item-pane-header-view-as =
    .label = Ver como
item-pane-header-none =
    .label = Nenhum
item-pane-header-title =
    .label = Título
item-pane-header-titleCreatorYear =
    .label = Título, Criador, Ano
item-pane-header-bibEntry =
    .label = Bibliography Entry
item-pane-header-more-options =
    .label = Mais opções
item-pane-message-items-selected =
    { $count ->
        [0] No items selected
        [one] { $count } item selected
       *[other] { $count } items selected
    }
item-pane-message-collections-selected =
    { $count ->
        [one] { $count } coleção selecionada
        [many] { $count } coleções selecionadas
       *[other] { $count } coleções selecionadas
    }
item-pane-message-searches-selected =
    { $count ->
        [one] { $count } pesquisa selecionada
        [many] { $count } pesquisas selecionadas
       *[other] { $count } pesquisas selecionadas
    }
item-pane-message-objects-selected =
    { $count ->
        [one] { $count } objeto selecionado
        [many] { $count } objetos selecionados
       *[other] { $count } objetos selecionados
    }
item-pane-message-unselected =
    { $count ->
        [0] No items in this view
        [one] { $count } item in this view
       *[other] { $count } items in this view
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Merge { $count } item
           *[other] Merge { $count } items
        }
locate-library-lookup-no-resolver = Você deve escolher um resolvedor a partir do painel { $pane } nas configurações do { -app-name } .
architecture-win32-warning-message = { -app-name } está rodando no modo 32-bit em um Windows de versão 64-bit. { -app-name } será mais eficiente se rodar no modo 64-bit.
architecture-warning-action = Baixar { -app-name } 64-bit
first-run-guidance-quickFormat =
    Digitar um título, autor e/ou um ano para buscar uma referência.
    
    Após selecionar, clicar no balão ou selecionar pelo teclado e pressionar ↓/Espaço para mostrar as opções de citação como número de página, prefixo e sufixo.
    
    Vocês também pode adicionar o número de página diretamente ao incluir com os termos da sua busca ou digitar depois do balão e pressionar { return-or-enter }.
first-run-guidance-authorMenu = { -app-name } permite que você especifique editores e tradutores também. Você pode transformar um autor em um editor ou tradutor selecionando a partir deste menu.
advanced-search-remove-btn =
    .tooltiptext = { general-remove }
advanced-search-add-btn =
    .tooltiptext = { general-add }
advanced-search-conditions-menu =
    .aria-label = Critérios de busca
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operador
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Valor
    .label = { $label }
