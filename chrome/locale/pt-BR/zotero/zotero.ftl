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
-os-name =
    { PLATFORM() ->
        [macos] macOS
        [windows] Windows
       *[other] Linux
    }
general-print = Imprimir
general-remove = Remover
general-add = Adicionar
general-remind-me-later = Lembrar-me mais tarde
general-dont-ask-again = Não perguntar novamente
general-choose-file = Selecionar arquivo...
general-open-settings = Abrir configurações
general-settings = Configuração...
general-help = Ajuda
general-tag = Etiqueta
general-got-it = Got It
general-done = Feito
general-view-troubleshooting-instructions = Ver instruções de resolução de problemas
general-go-back = Voltar
general-accept = Aceitar
general-cancel = Cancelar
cancel-button =
    .label = { general-cancel }
general-show-in-library = Mostrar na biblioteca
general-restartApp = Reiniciar { -app-name }
general-restartInTroubleshootingMode = Reiniciar no modo de resolução de erros
general-save = Salvar
general-clear = Limpar
clear-button =
    .label = { general-clear }
general-update = Atualizar
general-back = Voltar
general-edit = Editar
general-cut = Cortar
general-copy = Copiar
general-paste = Colar
general-find = Buscar
general-delete = Remover
general-insert = Inserir
general-and = e
general-et-al = et al.
general-previous = Anterior
general-next = Próximo
general-learn-more = Saber Mais
general-more-information = Mais informações
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
general-maroon = Marrom
general-gray = Cinza
general-black = Preto
general-loading = Carregando...
db-checking-integrity = Checking database integrity…
db-repairing = Repairing database…
citation-style-label = Estilo da citação:
language-label = Idioma:
menu-custom-group-submenu =
    .label = Mais opções...
menu-file-show-in-finder =
    .label = Mostrar no Finder
menu-file-show-file =
    .label = Exibir o arquivo
menu-file-show-files =
    .label = Mostrar arquivos
menu-print =
    .label = { general-print }
menu-density =
    .label = Densidade
add-attachment = Adicionar anexo
new-note = Nova nota
menu-add-by-identifier =
    .label = Adicionar por identificador…
menu-add-attachment =
    .label = { add-attachment }
menu-add-standalone-file-attachment =
    .label = Adicionar arquivo…
menu-add-standalone-linked-file-attachment =
    .label = Adicionar link para arquivo…
menu-add-child-file-attachment =
    .label = Anexar arquivo
menu-add-child-linked-file-attachment =
    .label = Anexar link para o arquivo…
menu-add-child-linked-url-attachment =
    .label = Anexar link para página…
menu-new-note =
    .label = { new-note }
menu-new-standalone-note =
    .label = Nova nota isolada
menu-new-item-note =
    .label = Nova nota de item
menu-restoreToLibrary =
    .label = Restaurar para a biblioteca
menu-deletePermanently =
    .label = Excluir permanentemente
menu-tools-plugins =
    .label = Extensões
menu-view-columns-move-left =
    .label = Mover Coluna à Esquerda
menu-view-columns-move-right =
    .label = Mover Coluna à Direita
menu-view-hide-context-annotation-rows =
    .label = Ocultar anotações não correspondentes
menu-view-note-font-size =
    .label = Tamanho da fonte das notas
menu-view-note-tab-font-size =
    .label = Tamanho da fonte das notas em Aba
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
    .key = D
zotero-toolbar-tabs-menu =
    .tooltiptext = Listar todas as abas
filter-collections = Filtrar coleções
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
recently-read = Lido recentemente
collections-menu-show-recently-read =
    .label = Mostrar { recently-read }
item-menu-remove-from-recently-read =
    .label = Remover dos { recently-read }…
items-section-collections-selected =
    { $count ->
        [one] { $count } coleção selecionada
        [many] { $count } coleções selecionadas
       *[other] { $count } coleções selecionadas
    }
items-section-searches-selected =
    { $count ->
        [one] { $count } saved search selected
       *[other] { $count } saved searches selected
    }
items-section-sources-selected =
    { $count ->
        [one] { $count } source selected
       *[other] { $count } sources selected
    }
items-section-library-collections =
    { $count ->
        [one] { $library } ({ $count } collection selected)
       *[other] { $library } ({ $count } collections selected)
    }
items-section-library-searches =
    { $count ->
        [one] { $library } ({ $count } saved search selected)
       *[other] { $library } ({ $count } saved searches selected)
    }
items-section-library-sources =
    { $count ->
        [one] { $library } ({ $count } source selected)
       *[other] { $library } ({ $count } sources selected)
    }
items-section-library-recently-read = { $library } ({ recently-read })
items-section-library = { $library }
collections-menu-rename =
    .label = Rename
edit-saved-search = Editar pesquisa salva
collections-menu-edit-search =
    .label = Edit Search
collections-menu-duplicate-search =
    .label = Duplicate Search
collections-menu-move-collection =
    .label = Mover para
collections-menu-copy-collection =
    .label = Copiar para
collections-menu-export =
    .label = Exportar...
collections-menu-generate-report =
    .label = Generate Report…
collections-menu-create-bibliography =
    .label = Create Bibliography…
collections-menu-unsubscribe =
    .label = Unsubscribe…
collections-menu-delete =
    .label =
        { $count ->
            [one] Delete Collection…
           *[other] Delete Collections…
        }
collections-menu-delete-with-items =
    .label =
        { $count ->
            [one] Delete Collection and Items…
           *[other] Delete Collections and Items…
        }
collections-menu-delete-search =
    .label =
        { $count ->
            [one] Delete Search…
           *[other] Delete Searches…
        }
collections-delete-title =
    { $count ->
        [one] Delete Collection
       *[other] Delete Collections
    }
collections-delete-message =
    { $count ->
        [one] Are you sure you want to delete this collection?
       *[other] Are you sure you want to delete { $count } collections?
    }
collections-delete-keep-items =
    { $count ->
        [one] Items within this collection will not be deleted.
       *[other] Items within these collections will not be deleted.
    }
collections-delete-with-items-title =
    { $count ->
        [one] Delete Collection and Items
       *[other] Delete Collections and Items
    }
collections-delete-with-items-message =
    { $count ->
        [one] Are you sure you want to delete this collection and move all items within it to the Trash?
       *[other] Are you sure you want to delete { $count } collections and move all items within them to the Trash?
    }
collections-delete-search-title =
    { $count ->
        [one] Delete Search
       *[other] Delete Searches
    }
collections-delete-search-message =
    { $count ->
        [one] Are you sure you want to delete this search?
       *[other] Are you sure you want to delete { $count } searches?
    }
item-creator-moveDown =
    .label = Mover para baixo
item-creator-moveToTop =
    .label = Mover para o topo
item-creator-moveUp =
    .label = Mover para cima
item-menu-viewAttachment =
    .label =
        Abrir { $numAttachments ->
            [one]
                { $attachmentType ->
                    [pdf] PDF
                    [epub] EPUB
                    [snapshot] captura
                    [note] nota
                   *[other] anexo
                }
           *[other]
                { $attachmentType ->
                    [pdf] PDFs
                    [epub] EPUBs
                    [snapshot] capturas
                    [note] notas
                   *[other] anexos
                }
        } { $openIn ->
            [tab] em nova aba
            [window] em nova janela
           *[other] { "" }
        }
item-menu-add-file =
    .label = Arquivo
item-menu-add-linked-file =
    .label = Arquivo relacionado
item-menu-add-url =
    .label = Ligação web
item-menu-change-parent-item =
    .label = Mudar item pai
item-menu-relate-items =
    .label = Relacionar itens
view-online = Ver online
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
import-where-from = De onde você deseja importar?
import-online-intro-title = Introdução
import-source-file =
    .label = Um arquivo (BibTeX, RIS, RDF do Zotero, etc.)
import-source-folder =
    .label = Uma pasta de PDFs ou outros arquivos
import-source-online =
    .label = Importação on-line a partir de { $targetApp }
import-options = Opções
import-importing = Importando...
import-create-collection =
    .label = Coloque coleções importadas e itens dentro de novas coleções
import-recreate-structure =
    .label = Recriar estrutura de pastas como coleções
import-fileTypes-header = Tipos de arquivo para importar:
import-fileTypes-pdf =
    .label = PDF
import-fileTypes-other =
    .placeholder = Outros padrões de arquivos, separados por vírgula (ex.: *.jpg,*.png)
import-file-handling = Manipulação de arquivo
import-file-handling-store =
    .label = Copiar arquivos para a pasta de armazenamento do { -app-name }
import-file-handling-link =
    .label = Link para arquivos na localização original
import-fileHandling-description = Arquivos linkados não podem ser sincronizados pelo { -app-name }.
import-online-new =
    .label = Baixar apenas itens novos; não atualizar itens importados anteriormente
import-mendeley-username = Usuário
import-mendeley-password = Senha
general-error = Erro
file-interface-import-error = Um erro ocorreu ao tentar importar o arquivo selecionado. Por favor, certifique-se de que o arquivo é válido e tente novamente.
file-interface-import-complete = Importação completa
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
import-online-relink-kb = { general-more-information }
import-online-connection-error = { -app-name } não conseguiu se conectar ao { $targetApp }. Por favor, verifique sua conexão com a internet e tente novamente.
tab-title-multiple-collections = Multiple
items-table-cell-notes =
    .aria-label =
        { $count ->
            [one] { $count } nota
            [many] { $count } notas
           *[other] { $count } notas
        }
items-column-added-by = Adicionado por
items-column-modified-by = Modificado por
items-column-last-read = Última leitura
report-error =
    .label = Relatar erro...
rtfScan-wizard =
    .title = Vasculhar RTF
rtfScan-introPage-description = { -app-name } pode automaticamente extrair e reformatar citações, e inserir uma bibliografia em arquivos RTF. Ele atualmente tem suporte a citações em variações dos seguintes formatos:
rtfScan-introPage-description2 = Para começar, selecione um arquivo RTF de entrada e um arquivo de saída abaixo:
rtfScan-input-file = Arquivo de entrada:
rtfScan-output-file = Arquivo de saída:
rtfScan-no-file-selected = Não foi selecionado nenhum arquivo
rtfScan-choose-input-file =
    .label = { general-choose-file }
    .aria-label = Selecione arquivo de entrada
rtfScan-choose-output-file =
    .label = { general-choose-file }
    .aria-label = Selecione arquivo de saída
rtfScan-intro-page = Introdução
rtfScan-scan-page = Procurando por citações
rtfScan-scanPage-description = { -app-name } está analisando seu documento por citações. Por favor, seja paciente.
rtfScan-citations-page = Verificar itens citados
rtfScan-citations-page-description = Por favor, revise a lista de citações reconhecidas para certificar-se que o { -app-name } selecionou os itens correspondentes de forma correta. Quaisquer citações não mapeadas ou ambíguas devem ser corrigidas antes de avançar para o próximo passo.
rtfScan-style-page = Formatação do documento
rtfScan-format-page = Formatando as citações
rtfScan-format-page-description = { -app-name } está processando e formatando seu arquivo RTF. Por favor, seja paciente.
rtfScan-complete-page = A análise do RTF foi concluída
rtfScan-complete-page-description = Seu documento foi vasculhado e processado. Por favor, certifique-se de que ele está formatado corretamente.
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
bibliography-advancedOptions-label = Opções avançadas
bibliography-outputMode-label = Modo de saída:
bibliography-outputMode-citations =
    .label =
        { $type ->
            [citation] Citações
            [note] Notas
           *[other] Citações
        }
bibliography-outputMode-bibliography =
    .label = Bibliografia
bibliography-outputMethod-label = Método de saída:
bibliography-outputMethod-saveAsRTF =
    .label = Salvar como RTF
bibliography-outputMethod-saveAsHTML =
    .label = Salvar como HTML
bibliography-outputMethod-copyToClipboard =
    .label = Copiar para a área de transferência
bibliography-outputMethod-print =
    .label = Imprimir
bibliography-manageStyles-label = Gerenciar estilos...
styleEditor-locatorType =
    .aria-label = Tipo de localizador
styleEditor-locatorInput = Entrada do localizador
styleEditor-citationStyle = { citation-style-label }
styleEditor-locale = { language-label }
styleEditor-editor =
    .aria-label = Editor de Estilos
styleEditor-preview =
    .aria-label = Visualização
publications-intro-page = Minhas Publicações
publications-intro = Itens que você adiciona a Minhas Publicações serão mostrados na sua página de perfil em zotero.org. Se você escolher incluir arquivos anexos, eles serão disponibilizados publicamente sob a licença que você especificar. Adicione apenas trabalhos que foram criados por você e inclua arquivos apenas se você tem direitos de distribuição e assim o deseja.
publications-include-checkbox-files =
    .label = Incluir arquivos
publications-include-checkbox-notes =
    .label = Incluir notas
publications-include-adjust-at-any-time = Você pode a qualquer momento ajustar o que mostrar da coleção Minhas Publicações.
publications-intro-authorship =
    .label = Eu criei este trabalho.
publications-intro-authorship-files =
    .label = Eu criei este trabalho e tenho os direitos de distribuição dos arquivos inclusos.
publications-sharing-page = Escolha como o seu trabalho pode ser compartilhado
publications-sharing-keep-rights-field =
    .label = Mantenha o campo de Direitos existente
publications-sharing-keep-rights-field-where-available =
    .label = Mantenha o campo de Direitos existente quando disponível
publications-sharing-text = Você pode reservar todos os direitos para seu trabalho usando a licença Creative Commons ou deixá-lo em domínio público. Em ambos os casos, o trabalho ficará publicamente disponível em zotero.org.
publications-sharing-prompt = Você gostaria de permitir que o seu trabalho seja compartilhado por outros?
publications-sharing-reserved =
    .label = Não, somente publique meu trabalho no zotero.org
publications-sharing-cc =
    .label = Sim, sob uma licença Creative Commons
publications-sharing-cc0 =
    .label = Sim, e coloque meu trabalho em domínio público
publications-license-page = Escolha uma licença Creative Commons
publications-choose-license-text = Uma licença Creative Commons permite que outros copiem e redistribuam seu trabalho com o devido crédito, forneça um link para a licença e indique se houver mudanças. Condições adicionais podem ser especificadas abaixo.
publications-choose-license-adaptations-prompt = Permitir que adaptações do seu trabalho sejam compartilhadas?
publications-choose-license-yes =
    .label = Sim
    .accesskey = Y
publications-choose-license-no =
    .label = Não
    .accesskey = N
publications-choose-license-sharealike =
    .label = Sim, desde que os outros compartilhem da mesma forma
    .accesskey = S
publications-choose-license-commercial-prompt = Permitir usos comerciais do seu trabalho?
publications-buttons-add-to-my-publications =
    .label = Adicionar às Minhas Publicações
publications-buttons-next-sharing =
    .label = Próximo: Compartilhar
publications-buttons-next-choose-license =
    .label = Escolha a licença
licenses-cc-0 = CC0 1.0 Dedicação Universal de Domínio Público
licenses-cc-by = Licença Creative Commons Attribution 4.0 International
licenses-cc-by-nd = Licença Creative Commons Attribution-NoDerivatives 4.0 International
licenses-cc-by-sa = Licença Creative Commons Attribution-ShareAlike 4.0 International
licenses-cc-by-nc = Licença Creative Commons Attribution-NonCommercial 4.0 International
licenses-cc-by-nc-nd = Licença Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International
licenses-cc-by-nc-sa = Licença Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International
licenses-cc-more-info = Certifique-se que leu as <a data-l10n-name="license-considerations">Considerações para licenças</a>do Creative Commons antes de colocar seu trabalho sob a licença CC. Saiba que a licença que você aplica não pode ser retirada, mesmo que posteriormente escolha termos diferentes ou retire a publicação do trabalho.
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
pane-info = Informações
pane-abstract = Resumo
pane-attachments = Anexos
pane-notes = Notas
pane-note-info = Informações da nota
pane-libraries-collections = Bibliotecas e Coleções
pane-tags = Etiquetas
pane-related = Relacionar
pane-attachment-info = Informação de anexo
pane-attachment-preview = Visualização
pane-attachment-annotations = Anotações
pane-header-attachment-associated =
    .label = Renomear arquivo associado
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
new-collection = Nova coleção...
menu-new-collection =
    .label = { new-collection }
toolbar-new-collection =
    .tooltiptext = { new-collection }
new-collection-dialog =
    .title = Nova coleção
    .buttonlabelaccept = Criar coleção
new-collection-name = Nome:
new-collection-create-in = Criar em:
show-publications-menuitem =
    .label = Mostrar Minhas Publicações
attachment-info-title = Título
attachment-info-filename = Nome do arquivo
attachment-info-accessed = Acessado em
attachment-info-pages = Páginas
attachment-info-modified = Data de modificação
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
note-info-parent-item = Item pai
note-info-parent-item-button =
    { $hasParentItem ->
        [true] { $parentItemTitle }
       *[false] Nenhum
    }
    .title =
        { $hasParentItem ->
            [true] Ver item pai na biblioteca
           *[false] Ver nota na biblioteca
        }
note-info-date-created = Criado
note-info-date-modified = Data de modificação
note-info-size = Tamanho
note-info-word-count = Contagem de palavras
note-info-character-count = Contagem de caracteres
item-title-empty-note = Nota sem título
attachment-preview-placeholder = Sem anexo para visualizar
attachment-rename-from-parent =
    .tooltiptext = Renomear arquivo para corresponder ao item pai
account-log-in = Log In
account-not-logged-in-text = Log in to your Zotero account to sync your data.
account-error-login-session-expired = Your login session has expired. Please try again.
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
    .aria-label = Pesquisa rápida
    .placeholder = { $placeholder }
    .aria-description = { $placeholder }
advanced-search = Pesquisa avançada
menuitem-advanced-search =
    .label = { advanced-search }
quicksearch-advanced-search-button =
    .tooltiptext = { advanced-search }
    .aria-label = { advanced-search }
advanced-search-close =
    .tooltiptext = Close Advanced Search
advanced-search-expand =
    .tooltiptext = Expand Advanced Search
advanced-search-collapse =
    .tooltiptext = Collapse Advanced Search
item-pane-header-view-as =
    .label = Ver como
item-pane-header-none =
    .label = Nenhum
item-pane-header-title =
    .label = Título
item-pane-header-titleCreatorYear =
    .label = Título, autor, ano
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
architecture-x64-on-arm64-action = Baixar { -app-name } para ARM64
first-run-guidance-authorMenu = { -app-name } permite que você especifique editores e tradutores também. Você pode transformar um autor em um editor ou tradutor selecionando a partir deste menu.
first-run-guidance-readAloud = { -app-name } agora pode ler seus documentos utilizando vozes com entonação natural.
advanced-search-remove-btn =
    .tooltiptext = Remove Condition
advanced-search-add-btn =
    .tooltiptext = Add Condition
advanced-search-group-btn =
    .tooltiptext = Add Condition Group
advanced-search-remove-group-btn =
    .tooltiptext = Remove Group
advanced-search-ungroup-btn =
    .tooltiptext = Ungroup Conditions
advanced-search-result-level-menu =
    .aria-label = Result type
advanced-search-result-level-prefix-root =
    .value = Buscar
advanced-search-join-prefix-root =
    .value = matching
advanced-search-result-level-any =
    .label = any items
advanced-search-result-level-item =
    .label = top-level items
advanced-search-result-level-attachment =
    .label = attachments
advanced-search-result-level-note =
    .label = notes
advanced-search-result-level-annotation =
    .label = anotações
advanced-search-binding-menu =
    .aria-label = Match against the same item
advanced-search-binding-separate =
    .label = separately
advanced-search-binding-same-attachment =
    .label = in the same attachment
advanced-search-binding-same-note =
    .label = in the same note
advanced-search-binding-same-annotation =
    .label = in the same annotation
advanced-search-of-the-following =
    .value = of the following
advanced-search-binding-hint-attachment =
    .value = These conditions can match separate attachments.
advanced-search-binding-hint-note =
    .value = These conditions can match separate notes.
advanced-search-binding-hint-annotation =
    .value = These conditions can match separate annotations.
advanced-search-level-warning-mixed = These conditions cannot all match the same item, so this search will never return results. Try matching “{ $matchAny }” of them, or set the result type to “{ $topLevelItems }”.
advanced-search-level-warning-unreachable = This search has a condition that cannot apply to the chosen result type. Set the result type to “{ $topLevelItems }” or remove the incompatible condition.
advanced-search-group-warning-unreachable =
    A condition here cannot be in the same { $entity ->
        [attachment] attachment
        [note] note
       *[annotation] annotation
    }. Match these separately or remove the incompatible condition.
advanced-search-group-warning-mixed = These conditions cannot all match the same item, so this group will never match. Try matching “{ $matchAny }” of them, or set the result type to “{ $topLevelItems }”.
advanced-search-bind-same-attachment =
    .label = Match the same attachment
advanced-search-bind-same-note =
    .label = Match the same note
advanced-search-bind-same-annotation =
    .label = Match the same annotation
advanced-search-conditions-menu =
    .aria-label = Critérios de busca
    .label = { $label }
advanced-search-operators-menu =
    .aria-label = Operador
    .label = { $label }
advanced-search-condition-input =
    .aria-label = Valor
    .label = { $label }
search-operator-isEmpty = is empty
search-operator-isNotEmpty = is not empty
search-conditions-tooltip-fields = Campos:
search-conditions-collection = Coleção
search-conditions-savedSearch = Pesquisa salva
search-conditions-itemTypeID = Tipo do item
search-conditions-tag = Etiqueta
search-conditions-numTags = # of Tags
search-conditions-numNotes = # of Notes
search-conditions-numAttachments = # of Attachments
search-conditions-numAnnotations = # of Annotations
search-conditions-note = Nota
search-conditions-childNote = Nota associada
search-conditions-creator = Autor
search-conditions-thesisType = Tipo de tese
search-conditions-reportType = Tipo de relatório
search-conditions-videoRecordingFormat = Formato de gravação de video
search-conditions-audioFileType = Tipo de arquivo de áudio
search-conditions-audioRecordingFormat = Formato de gravação de áudio
search-conditions-letterType = Tipo de carta
search-conditions-interviewMedium = Suporte da entrevista
search-conditions-manuscriptType = Tipo de manuscrito
search-conditions-presentationType = Tipo de apresentação
search-conditions-mapType = Tipo de mapa
search-conditions-artworkMedium = Suporte da obra de arte
search-conditions-dateModified = Data de modificação
search-conditions-fulltextContent = Conteúdo do anexo
search-conditions-programmingLanguage = Linguagem de programação
search-conditions-fileTypeID = Tipo de arquivo anexo
search-conditions-attachmentStorageType = Attachment Storage Type
search-conditions-lastRead = Último anexo lido
search-conditions-annotationText = Anotação de texto
search-conditions-annotationComment = Anotação de comentário
search-conditions-annotationType = Annotation Type
search-conditions-annotationColor = Annotation Color
search-conditions-annotationAuthor = Annotation Author
search-conditions-anyField = Todos os campos
search-conditions-titleCreatorYear = Título, autor, ano
search-conditions-submenu-attachment = Anexo
search-conditions-submenu-annotation = Anotação
search-conditions-short-fulltextContent = Content
search-conditions-short-fileTypeID = Tipo de arquivo
search-conditions-short-attachmentStorageType = Storage Type
search-conditions-short-lastRead = Última leitura
search-conditions-short-annotationText = Text
search-conditions-short-annotationComment = Comment
search-conditions-short-annotationType = Tipo
search-conditions-short-annotationColor = Color
search-conditions-short-annotationAuthor = Autor
find-pdf-files-added =
    { $count ->
        [one] { $count } arquivo adicionado
        [many] { $count } arquivos adicionados
       *[other] { $count } arquivos adicionados
    }
select-items-window =
    .title = Selecionar itens
select-items-dialog =
    .buttonlabelaccept = Selecionar
select-items-convertToStandalone =
    .label = Transformar em isolada
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
file-type-ebook = Livro eletrônico
attachment-storage-type-storedFile = Stored File
attachment-storage-type-linkedFile = Linked File
attachment-storage-type-webLink = Web Link
post-upgrade-message = Foi atualizado para <span data-l10n-name="post-upgrade-appver">{ -app-name } { $version }</span>! Descubra <a data-l10n-name="new-features-link">as novidades</a>.
post-upgrade-remind-me-later =
    .label = { general-remind-me-later }
post-upgrade-done =
    .label = { general-done }
text-action-paste-and-search =
    .label = Colar e buscar
mac-word-plugin-install-message = Zotero precisa acessar os dados do Word para instalar a extensão do Word.
mac-word-plugin-install-folder-message = { -app-name } needs access to Word’s startup folder to install the Word plugin.
mac-word-plugin-install-action-button =
    .label = Instalar Extensão do Word
mac-word-plugin-install-remind-later-button =
    .label = { general-remind-me-later }
mac-word-plugin-install-dont-ask-again-button =
    .label = { general-dont-ask-again }
mac-word-plugin-install-folder-dialog-title = Install the plugin in the Word startup folder
mac-word-plugin-install-folder-dialog-button = Instalar
mac-word-plugin-install-wrong-folder-selected = The suggested folder must be selected. Please try again without choosing a different folder.
file-renaming-banner-message = { -app-name }  agora mantém nomes de arquivos de anexos automaticamente sincronizados a medida que faz alteração nos itens.
file-renaming-banner-documentation-link = { general-learn-more }
file-renaming-banner-settings-link = { general-settings }
connector-version-warning = O conector do { -app-name } deve ser atualizado para funcionar com esta versão do { -app-name }.
userjs-pref-warning = Algumas configurações do { -app-name } foram substituídas utilizando um método sem suporte. { -app-name } irá revertê-las e reiniciar.
migrate-extra-fields-progress-message = Migrando novos campos a partir do campo Extra
search-normalization-progress-message = Indexing items for search
long-tag-fixer-window-title =
    .title = Dividir etiquetas
long-tag-fixer-button-dont-split =
    .label = Não dividir
menu-normalize-attachment-titles =
    .label = Padronizar títulos de anexos...
normalize-attachment-titles-title = Padronizar títulos de anexos
normalize-attachment-titles-text =
    { -app-name } renomeia automaticamente os arquivos salvos usando os metadados do item pai, mas utiliza títulos mais simples como “Full Text PDF”, “Preprint PDF”, ou “PDF” para anexos principais visando manter a lista de itens mais limpa e evitar duplicação de informação.
    
    Em versões mais antigas do { -app-name }, assim como no uso de algumas extensões, títulos dos anexos podiam ser alterados, desnecessariamente, para coincidir com o nome dos arquivos.
    
    Gostaria de atualizar os anexos selecionados para usar títulos mais simples? Apenas anexos principais com títulos que correspondem ao nome do arquivo serão alterados.
banner-close-button =
    .aria-label = Dispensar notificação
plugins-blocked-plugin =
    .message = Este complemento foi desabilitado por { -app-name }.
data-dir-unsupported-storage = Isto pode acontecer se o diretório de dados do { -app-name } estiver em uma pasta de armazenamento na nuvem (OneDrive, Dropbox, etc.) ou em uma rede de compartilhamento.
login-manager-reset = { -app-name } was unable to read your saved login information, so it has been reset. Please log in again in the { preferences-pane-account } pane of the { -app-name } settings.
os-keystore-save-failed =
    { PLATFORM() ->
        [macos] { -app-name } couldn’t access the { -os-name } Keychain to securely save your credentials. Make sure your Keychain is accessible and try again.
        [windows] { -app-name } couldn’t securely save your credentials. Try again or restart { -app-name }.
       *[other] { -app-name } couldn’t access your { -os-name } keyring to securely save your credentials. Make sure a keyring service is running and try again.
    }
os-keystore-migrate-failed =
    { PLATFORM() ->
        [macos] { -app-name } couldn’t access the { -os-name } Keychain to encrypt your stored credentials. Your credentials remain stored unencrypted on disk. Make sure your Keychain is accessible and restart { -app-name }.
        [windows] { -app-name } couldn’t encrypt your stored credentials. Your credentials remain stored unencrypted on disk. Restart { -app-name } and try again.
       *[other] { -app-name } couldn’t access your { -os-name } keyring to encrypt your stored credentials. Your credentials remain stored unencrypted on disk. Make sure a keyring service is running and restart { -app-name }.
    }
search-button =
    .label = Pesquisa
save-search-new-button =
    .label = Save Search…
save-search-edit-button =
    .label = Salvar
save-search-name-title = Salvar pesquisa
save-search-name-message = Enter a name for the saved search:
saved-search-close-confirmation-title = Editing Saved Search
saved-search-close-confirmation-body = Do you want to save changes you made to this saved search?
item-pane-batch-editing-prompt =
    .aria-label = Batch editing
item-pane-batch-editing-enable =
    .label = Edit Multiple Items…
item-pane-batch-editing-multiple-values-placeholder = Multiple
item-pane-batch-editing-clear-values = Clear all values
item-pane-batch-editing-header =
    { $count ->
        [one] Editing { $count } item
       *[other] Editing { $count } items
    }
item-pane-batch-editing-done =
    .label = { general-done }
undo-action-edit-metadata =
    { $count ->
        [one] Edit Metadata
       *[other] Edit Metadata for { $count } Items
    }
undo-action-edit-field =
    { $count ->
        [one] Edit of “{ $field }”
       *[other] Edit of “{ $field }” for { $count } Items
    }
undo-action-normalize-attachment-titles = Normalize Attachment Title
undo-action-trash =
    { $count ->
        [one] Trash Item
       *[other] Trash { $count } Items
    }
undo-action-restore-items =
    { $count ->
        [one] Restore Item
       *[other] Restore { $count } Items
    }
undo-action-trash-collection =
    { $count ->
        [one] Trash Collection
       *[other] Trash { $count } Collections
    }
undo-action-trash-search =
    { $count ->
        [one] Trash Saved Search
       *[other] Trash { $count } Saved Searches
    }
undo-action-restore-collection =
    { $count ->
        [one] Restore Collection
       *[other] Restore { $count } Collections
    }
undo-action-restore-objects =
    { $count ->
        [one] Restore Object
       *[other] Restore { $count } Objects
    }
undo-action-add-to-collection =
    { $count ->
        [one] Add to Collection
       *[other] Add { $count } Items to Collection
    }
undo-action-remove-from-collection =
    { $count ->
        [one] Remove from Collection
       *[other] Remove { $count } Items from Collection
    }
undo-action-move-to-collection =
    { $count ->
        [one] Move to Collection
       *[other] Move { $count } Items to Collection
    }
undo-action-rename-collection = Renomear coleção
undo-action-move-collection = Move Collection
undo-action-add-tag =
    { $count ->
        [one] Add Tag
       *[other] Add Tag to { $count } Items
    }
undo-action-change-tag = Change Tag
undo-action-split-tag = Split Tag
undo-action-remove-tag =
    { $count ->
        [one] Remove Tag
       *[other] Remove Tag from { $count } Items
    }
undo-action-remove-tags-from-item =
    { $count ->
        [one] Remove Tag
       *[other] Remove { $count } Tags
    }
undo-action-remove-all-tags = Remove All Tags
undo-action-edit-note = Editar Nota
undo-action-add-creator = Add Creator
undo-action-remove-creator = Remove Creator
undo-action-edit-creator = Edit Creator
undo-action-reorder-creator = Reorder Creator
undo-action-change-type = Mudar tipo do item
undo-action-change-parent-item =
    { $count ->
        [one] Change Parent Item
       *[other] Change Parent for { $count } Items
    }
undo-action-convert-to-standalone =
    { $count ->
        [one] Convert to Standalone
       *[other] Convert { $count } Items to Standalone
    }
undo-action-add-related = Add Related
undo-action-remove-related = Remove Related
undo-action-merge-items =
    { $count ->
        [one] Merge Item
       *[other] Merge { $count } Items
    }
menu-edit-undo-action = Undo { $action }
menu-edit-redo-action = Redo { $action }
