general-sentence-separator = { " " }
general-key-control = Control
general-key-shift = Shift
general-key-alt = Alt
general-key-option = Option
general-key-command = Command
option-or-alt =
    { PLATFORM() ->
        [macos] { general-key-option }
       *[other] { general-key-alt }
    }
command-or-control =
    { PLATFORM() ->
        [macos] { general-key-command }
       *[other] { general-key-control }
    }
return-or-enter =
    { PLATFORM() ->
        [macos] Return
       *[other] Enter
    }
delete-or-backspace =
    { PLATFORM() ->
        [macos] Delete
       *[other] Backspace
    }
general-print = Imprimir
general-remove = Remover
general-add = Adicionar
general-remind-me-later = Lembrar-me Mais Tarde
general-dont-ask-again = Não Perguntar Novamente
general-choose-file = Escolher Arquivo...
general-open-settings = Abrir Configurações
general-settings = Configuração...
general-help = Ajuda
general-tag = Etiqueta
general-done = Feito
general-view-troubleshooting-instructions = Ver instruções de resolução de problemas
general-go-back = Retroceder
general-accept = Aceitar
general-cancel = Cancelar
general-show-in-library = Mostrar na Biblioteca
general-restartApp = Reiniciar { -app-name }
general-restartInTroubleshootingMode = Reiniciar no modo de resolução de erros
general-save = Guardar
general-clear = Limpar
general-update = Atualizar
general-back = Retroceder
general-edit = Editar
general-cut = Cortar
general-copy = Copiar
general-paste = Colar
general-find = Localizar
general-delete = Remover
general-insert = Inserir
general-and = e
general-et-al = et al.
general-previous = Anterior
general-next = Seguinte
general-learn-more = Saber Mais
general-warning = Aviso
general-type-to-continue = Digite “{ $text }” para continuar.
general-continue = Continuar
general-red = Vermelho
general-orange = Laranja
general-yellow = Amarelo
general-green = Verde
general-teal = verde-azulado
general-blue = Azul
general-purple = Roxo
general-magenta = Magenta
general-violet = violeta
general-maroon = marrom
general-gray = Cinza
general-black = Preto
general-loading = A Carregar...
citation-style-label = Estilo de Citação:
language-label = Língua:
menu-custom-group-submenu =
    .label = Mais opções...
menu-file-show-in-finder =
    .label = Mostrar no Finder
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
    .label = Adicionar Arquivo…
menu-add-standalone-linked-file-attachment =
    .label = Adicionar link para Arquivo...
menu-add-child-file-attachment =
    .label = Anexar Arquivo
menu-add-child-linked-file-attachment =
    .label = Anexar Ligação a Arquivo…
menu-add-child-linked-url-attachment =
    .label = Anexar link para página…
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
menu-view-columns-move-left =
    .label = Mover Coluna à Esquerda
menu-view-columns-move-right =
    .label = Mover Coluna à Direita
menu-view-note-font-size =
    .label = Tamanho da Fonte Tipográfica das Notas
menu-view-note-tab-font-size =
    .label = Note Tab Font Size
menu-show-tabs-menu =
    .label = Mostrar menu de abas
menu-edit-copy-annotation =
    .label =
        { $count ->
            [one] Copiar anotação
            [many] Copiar { $count } anotações
           *[other] Copiar { $count } anotações
        }
main-window-command =
    .label = Biblioteca
main-window-key =
    .key = R
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
zotero-toolbar-tabs-scroll-forwards =
    .title = Avançar
zotero-toolbar-tabs-scroll-backwards =
    .title = Retroceder
toolbar-add-attachment =
    .tooltiptext = { add-attachment }
collections-menu-rename-collection =
    .label = Renomear coleção
collections-menu-edit-saved-search =
    .label = Editar Procura Guardada
collections-menu-move-collection =
    .label = Mover para
collections-menu-copy-collection =
    .label = Copiar para
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
                    [note] Note
                   *[other] Attachment
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDFs
                    [epub] EPUBs
                    [snapshot] Snapshots
                    [note] Notes
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
    .label = Ligação web
item-menu-change-parent-item =
    .label = Mudar item pai…
item-menu-relate-items =
    .label = Relacionar itens
view-online = Ver em Linha
item-menu-option-view-online =
    .label = { view-online }
item-button-view-online =
    .tooltiptext = { view-online }
file-renaming-file-renamed-to = Arquivo renomeado para { $filename }
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
    .label = PDF
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
rtfScan-introPage-description = { -app-name } pode automaticamente extrair e reformatar citações, e inserir uma bibliografia em arquivos RTF. Ele atualmente tem suporte a citações em variações dos seguintes formatos:
rtfScan-introPage-description2 = Para começar, seleccione abaixo um arquivo RTF de entrada bem como um arquivo RTF de saída:
rtfScan-input-file = Ficheiro de entrada:
rtfScan-output-file = Ficheiro de saída:
rtfScan-no-file-selected = Nenhum arquivo escolhido
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Selecione arquivo de entrada
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Selecione arquivo de saída
rtfScan-intro-page = Introdução
rtfScan-scan-page = Processando à Procura de Citações
rtfScan-scanPage-description = { -app-name } está analisando seu documento por citações. Por favor, seja paciente.
rtfScan-citations-page = Verificar Itens Citados
rtfScan-citations-page-description = Por favor, revise a lista de citações reconhecidas para certificar-se que o { -app-name } selecionou os itens correspondentes de forma correta. Quaisquer citações não mapeadas ou ambíguas devem ser corrigidas antes de avançar para o próximo passo.
rtfScan-style-page = Formatação do Documento
rtfScan-format-page = Formatação das Citações
rtfScan-format-page-description = { -app-name } está processando e formatando seu arquivo RTF. Por favor, seja paciente.
rtfScan-complete-page = Processamento RTF Completo
rtfScan-complete-page-description = O seu documento foi processado. Por favor assegure-se de que está correctamente formatado.
rtfScan-action-find-match =
    .title = Selecionar item correspondente
rtfScan-action-accept-match =
    .title = Aceitar esta correspondência
runJS-title = Executar JavaScript
runJS-editor-label = Código:
runJS-run = Executar
runJS-help = { general-help }
runJS-completed = Concluído com sucesso
runJS-result =
    { $type ->
        [async] Valor de retorno:
       *[other] Resultado:
    }
runJS-run-async = Executar como função assíncrona
bibliography-window =
    .title = { -app-name } - Criar Citação/Bibliografia
bibliography-style-label = { citation-style-label }
bibliography-locale-label = { language-label }
bibliography-displayAs-label = Mostrar citações como:
bibliography-advancedOptions-label = Opções Avançadas
bibliography-outputMode-label = Modo de Saída:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citações
            [note] Notas
           *[other] Citações
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
styleEditor-locatorType =
    .aria-label = Tipo de localizador
styleEditor-locatorInput = Entrada do localizador
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = Editor de Estilos
styleEditor-preview =
    .aria-label = Visualização
publications-intro-page = As Minhas Publicações
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
publications-sharing-page = Escolha a forma de partilha do seu trabalho
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
publications-license-page = Escolha uma licença Creative Commons
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
debug-output-logging-restart-in-troubleshooting-mode-checkbox = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-menuitem =
    .label = Reiniciar no modo de resolução de erros...
    .accesskey = T
restart-in-troubleshooting-mode-dialog-title = { general-restartInTroubleshootingMode }
restart-in-troubleshooting-mode-dialog-description = { -app-name } iniciará com todas as extensões desabilitadas. Alguns recursos podem não funcionar corretamente enquanto o modo de resolução de erros está ativo.
menu-ui-density =
    .label = Densidade
menu-ui-density-comfortable =
    .label = Confortável
menu-ui-density-compact =
    .label = Compacto
pane-item-details = Detalhes do Item
pane-info = Informação
pane-abstract = Resumo
pane-attachments = Anexos
pane-notes = Notas
pane-note-info = Note Info
pane-libraries-collections = Bibliotecas e Coleções
pane-tags = Etiquetas
pane-related = Relações
pane-attachment-info = Informação de anexo
pane-attachment-preview = Visualização
pane-attachment-annotations = Anotações
pane-header-attachment-associated =
    .label = Alterar nome do arquivo associado
item-details-pane =
    .aria-label = { pane-item-details }
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
section-attachments-move-to-trash-message = Tem certeza que deseja mover “{ $title }” para a lixeira ?
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
    .label = Expandir a secção { $section }
section-button-collapse =
    .dynamic-tooltiptext = Comprimir seção
    .label = Colapsar a secção { $section }
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
sidenav-note-info =
    .tooltiptext = { pane-note-info }
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
sidenav-main-btn-grouping =
    .aria-label = { pane-item-details }
sidenav-reorder-up =
    .label = Mover seção para cima
sidenav-reorder-down =
    .label = Mover seção para baixo
sidenav-reorder-reset =
    .label = Reiniciar Ordem da Seção
toggle-item-pane =
    .tooltiptext = Alternar Painel de Item
toggle-context-pane =
    .tooltiptext = Ativar Painel de Contexto
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
context-notes-return-button =
    .aria-label = { general-go-back }
new-collection = Nova Colecção...
menu-new-collection =
    .label = { new-collection }
toolbar-new-collection =
    .tooltiptext = { new-collection }
new-collection-dialog =
    .title = Nova Colecção
    .buttonlabelaccept = Criar Coleção
new-collection-name = Nome:
new-collection-create-in = Criar em:
show-publications-menuitem =
    .label = Mostrar Minhas Publicações
attachment-info-title = Título
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
section-note-info =
    .label = { pane-note-info }
note-info-title = Título
note-info-parent-item = Parent Item
note-info-parent-item-button =
    { $hasParentItem ->
        [true] { $parentItemTitle }
       *[false] None
    }
    .title =
        { $hasParentItem ->
            [true] View parent item in library
           *[false] View note item in library
        }
note-info-date-created = Created
note-info-date-modified = Modificado
note-info-size = Tamanho
note-info-word-count = Word Count
note-info-character-count = Character Count
item-title-empty-note = Nota Sem Título
attachment-preview-placeholder = Sem anexo para visualizar
attachment-rename-from-parent =
    .tooltiptext = Renomear arquivo para corresponder ao item pai
file-renaming-auto-rename-prompt-title = Renomeando configurações alteradas
file-renaming-auto-rename-prompt-body = Você gostaria de renomear os arquivos existentes na sua biblioteca para corresponder as novas configurações?
file-renaming-auto-rename-prompt-yes = Visualizar mudanças...
file-renaming-auto-rename-prompt-no = Manter nomes de arquivo existentes
rename-files-preview =
    .buttonlabelaccept = Renomear arquivos
rename-files-preview-loading = A Carregar...
rename-files-preview-intro = { -app-name } irá renomear oa seguintes arquivos na sua biblioteca para corresponder aos seus itens pai:
rename-files-preview-renaming = Renomeando...
rename-files-preview-no-files = Todos os nomes de arquivo já correspondem aos itens pai. Nenhuma mudança é necessária.
toggle-preview =
    .label =
        { $type ->
            [open] Esconder
            [collapsed] Mostrar
           *[unknown] Toggle
        } visualização de anexo
annotation-image-not-available = [Imagem não disponível]
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
    .label = Entrada bibliográfica
item-pane-header-more-options =
    .label = Mais opções
item-pane-message-items-selected =
    { $count ->
        [0] Sem itens selecionados
        [one] { $count } item selecionado
       *[other] { $count } itens selecionados
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
        [0] Não há itens nesta visualização
        [one] { $count } item nesta visualização
       *[other] { $count } itens nesta visualização
    }
item-pane-message-objects-unselected =
    { $count ->
        [0] Não há objetos nesta visualização
        [one] { $count } objeto nesta visualização
       *[other] { $count } objetos nesta visualização
    }
item-pane-duplicates-merge-items =
    .label =
        { $count ->
            [one] Mesclar { $count } item
            [many] Mesclar { $count } itens
           *[other] Mesclar { $count } itens
        }
locate-library-lookup-no-resolver = Você deve escolher um resolvedor a partir do painel { $pane } nas configurações do { -app-name } .
architecture-win32-warning-message = Mude para { -app-name } 64-bit para ter uma performance melhor. Seus dados não serão afetados.
architecture-warning-action = Baixar { -app-name } 64-bit
architecture-x64-on-arm64-message = { -app-name } está sendo executado em modo emulado. Uma versão nativa do { -app-name } será mais eficientemente.
architecture-x64-on-arm64-action = Descarregar { -app-name } para ARM64
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
find-pdf-files-added =
    { $count ->
        [one] { $count } arquivo adicionado
        [many] { $count } arquivos adicionados
       *[other] { $count } arquivos adicionados
    }
select-items-window =
    .title = Seleccionar Itens
select-items-dialog =
    .buttonlabelaccept = Selecionar
select-items-convertToStandalone =
    .label = Converter para independente
select-items-convertToStandaloneAttachment =
    .label =
        { $count ->
            [one] Converter para anexo isolado
            [many] Converter para anexos isolados
           *[other] Converter para anexos isolados
        }
select-items-convertToStandaloneNote =
    .label =
        { $count ->
            [one] Transformar em nota isolada
            [many] Transformar em notas isoladas
           *[other] Transformar em notas isoladas
        }
file-type-webpage = Página web
file-type-image = Imagem
file-type-pdf = PDF
file-type-audio = Áudio
file-type-video = Vídeo
file-type-presentation = Apresentação
file-type-document = Documento
file-type-ebook = e-book
post-upgrade-message = You’ve been upgraded to <span data-l10n-name="post-upgrade-appver">{ -app-name } { $version }</span>! Learn about <a data-l10n-name="new-features-link">what’s new</a>.
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Colar e buscar
mac-word-plugin-install-message = Zotero precisa acessar os dados do Word para instalar a extensão do Word.
mac-word-plugin-install-action-button =
    .label = Instalar Extensão do Word
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
file-renaming-banner-message = { -app-name }  agora mantém nomes de arquivos de anexos automaticamente sincronizados a medida que faz alteração nos itens.
file-renaming-banner-documentation-link = { general-learn-more }
file-renaming-banner-settings-link = { general-settings }
connector-version-warning = O conector do { -app-name } deve ser atualizado para funcionar com esta versão do { -app-name }.
userjs-pref-warning = Algumas configurações do { -app-name } foram substituídas utilizando um método sem suporte. { -app-name } irá revertê-las e reiniciar.
migrate-extra-fields-progress-message = Migrating new fields from Extra field
long-tag-fixer-window-title =
    .title = Dividir etiquetas
long-tag-fixer-button-dont-split =
    .label = Não dividir
menu-normalize-attachment-titles =
    .label = Normalize Attachment Titles…
normalize-attachment-titles-title = Normalize Attachment Titles
normalize-attachment-titles-text =
    { -app-name } automatically renames files on disk using parent item metadata, but it uses separate, simpler titles such as “Full Text PDF”, “Preprint PDF”, or “PDF” for primary attachments to keep the items list cleaner and avoid duplicating information.
    
    In older versions of { -app-name }, as well as when using certain plugins, attachment titles could be changed unnecessarily to match the filenames.
    
    Would you like to update the selected attachments to use simpler titles? Only primary attachments with titles that match the filename will be changed.
