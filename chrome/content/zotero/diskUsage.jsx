Components.utils.import("resource://gre/modules/Services.jsm");

const React = require('react');
const ReactDOM = require('react-dom');
const { IntlProvider } = require('react-intl');
const PropTypes = require('prop-types');
const VirtualizedTable = require('components/virtualized-table');
const Icons = require('components/icons');

class DiskUsageTable extends React.Component {
	constructor(props) {
		super(props);
		this.state = { rows: [] };
	}

	async loadItems() {
		let items = await Zotero.Items.getAll(this.props.libraryID, true, true);
		let rows = await Promise.all(
			items.map(async (item) => {
				let size = await item.getFileSize();
				return {
					item,
					size: size,
					formattedSize: Zotero.File.formatFileSize(size)
				};
			})
		);
		rows = rows
			.filter(row => row.size > 0)
			.sort((a, b) => b.size - a.size);
		this.setState({ rows });
		if (this._tree) {
			this._tree.invalidate();
		}
	}

	componentDidMount() {
		this.loadItems();
	}

	componentDidUpdate(prevProps) {
		if (this.props.libraryID !== prevProps.libraryID) {
			this.loadItems();
		}
	}

	renderItem = (index, selection, oldDiv = null, columns) => {
		let row = this.state.rows[index];
		let div;
		if (oldDiv) {
			div = oldDiv;
			div.innerHTML = "";
		}
		else {
			div = document.createElementNS("http://www.w3.org/1999/xhtml", 'div');
			div.className = "row";
		}
		div.classList.toggle('selected', selection.isSelected(index));

		for (let column of columns) {
			let span = document.createElementNS("http://www.w3.org/1999/xhtml", 'span');
			span.className = `cell ${column.className}`;

			if (column.primary) {
				span.classList.add('primary');
				let icon = Icons.getDOMElement(Zotero.Utilities.Internal.getTreeItemIconClass(row.item));
				icon.classList.add('cell-icon');
				icon.setAttribute('aria-label', Zotero.getString(`itemTypes.${row.item.itemType}`));
				span.appendChild(icon);
			}

			let text;
			switch (column.dataKey) {
				case 'displayTitle':
					text = row.item.getDisplayTitle();
					break;
				case 'firstCreator':
					text = row.item.firstCreator;
					break;
				case 'formattedSize':
					text = row.formattedSize;
					break;
				default:
					Zotero.debug('Unknown data key: ' + column.dataKey);
			}

			let textSpan = document.createElementNS("http://www.w3.org/1999/xhtml", 'span');
			textSpan.className = "cell-text";
			textSpan.innerText = text;
			span.appendChild(textSpan);

			div.appendChild(span);
		}

		return div;
	};

	handleActivate = (event, indices) => {
		if (!indices.length) return;
		let win = Services.wm.getMostRecentWindow('navigator:browser');
		if (win) {
			win.ZoteroPane.selectItem(this.state.rows[indices[0]].id, false, true)
				.then(() => win.focus());
		}
	};

	render() {
		let columns = [
			{
				dataKey: "displayTitle",
				label: "zotero.items.title_column",
				primary: true,
			},
			{
				dataKey: "firstCreator",
				label: "zotero.items.creator_column",
				fixedWidth: true,
				width: '100'
			},
			{
				dataKey: "formattedSize",
				label: "zotero.import.size",
				fixedWidth: true,
				width: '85'
			},
		];

		return (
			<VirtualizedTable
				ref={ref => this._tree = ref}
				getRowCount={() => this.state.rows.length}
				id="disk-usage-table"
				renderItem={this.renderItem}
				showHeader={true}
				columns={columns}
				staticColumns={true}
				disableFontSizeScaling={true}
				onActivate={this.handleActivate}
			/>
		);
	}

	static propTypes = {
		libraryID: PropTypes.number.isRequired
	};
}

Zotero.DiskUsage = {
	libraryID: Zotero.Libraries.userLibraryID,

	async onLoad() {
		let libraryMenu = document.querySelector('#disk-usage-library-list');
		let libraries = Zotero.Libraries.getAll().filter(lib => lib.libraryType !== 'feed');
		Zotero.Utilities.Internal.buildLibraryMenu(
			libraryMenu,
			libraries);
		libraryMenu.addEventListener('command', event => this.viewLibrary(parseInt(event.target.value)));
		this.viewLibrary(libraries[0].id);
	},

	viewLibrary(id) {
		// We don't really need to rerender the entire tree, but in this case
		// it's pretty much equivalent
		let container = document.querySelector('#disk-usage-container');
		ReactDOM.render(
			<IntlProvider locale={Zotero.locale} messages={Zotero.Intl.strings}>
				<DiskUsageTable libraryID={id} />
			</IntlProvider>,
			container
		);
	}
};
