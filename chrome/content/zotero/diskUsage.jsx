Components.utils.import("resource://gre/modules/Services.jsm");

const React = require('react');
const ReactDOM = require('react-dom');
const { IntlProvider, FormattedMessage } = require('react-intl');
const PropTypes = require('prop-types');
const VirtualizedTable = require('components/virtualized-table');
const Icons = require('components/icons');

class DiskUsageTable extends React.Component {
	constructor(props) {
		super(props);
		this.state = { rows: [], loading: true };
	}

	async loadItems() {
		this.props.onLoadBegin();

		let items = await Zotero.Items.getAll(this.props.libraryID, true, true);
		let rows = [];

		// Add all items to the list using possibly cached sizes
		await Promise.all(items.map(async (item) => {
			await this._insertItem(item, rows);
		}));
		this.setState({ rows, loading: false });

		// Main load is done
		this.props.onLoadEnd();

		// Wait a bit and recalculate sizes without cache
		await Zotero.Promise.delay(500);
		await Promise.all(items.map(async (item) => {
			await item.clearFileSize();
			await this._insertItem(item, rows, true);
		}));
		this.setState({ rows });
		this._tree.invalidate();
	}

	async _insertItem(item, rows, checkForExisting = false) {
		let size = await item.getFileSize();

		if (checkForExisting) {
			let oldIndex = rows.findIndex(other => other.item === item);
			if (oldIndex !== -1) {
				if (rows[oldIndex].size === size) {
					return;
				}

				// If sizes are different, first remove the old item
				// before we add the new one below
				rows.splice(oldIndex, 1);
			}
		}

		if (size > 0) {
			let row = {
				item,
				size: size,
				formattedSize: Zotero.File.formatFileSize(size)
			};
			Zotero.Utilities.Internal.insertSorted(rows, row, x => -x.size);
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
		const HTML_NS = "http://www.w3.org/1999/xhtml";

		let row = this.state.rows[index];
		let div;
		if (oldDiv) {
			div = oldDiv;
			div.innerHTML = "";
		}
		else {
			div = document.createElementNS(HTML_NS, 'div');
			div.className = "row";
		}
		div.classList.toggle('selected', selection.isSelected(index));

		for (let column of columns) {
			let span = document.createElementNS(HTML_NS, 'span');
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

			let textSpan = document.createElementNS(HTML_NS, 'span');
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
			win.ZoteroPane.selectItem(this.state.rows[indices[0]].item.id, false, true)
				.then(() => win.focus());
		}
	};

	render() {
		if (this.state.loading) {
			return (
				<div className={"items-tree-message"}>
					<FormattedMessage id="zotero.general.loading" />
				</div>
			);
		}
		else if (!this.state.rows.length) {
			return (
				<div className={"items-tree-message"}>
					<FormattedMessage id="zotero.diskUsageDialog.noItems" />
				</div>
			);
		}

		let columns = [
			{
				dataKey: "displayTitle",
				label: "itemFields.title",
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
		libraryID: PropTypes.number.isRequired,
		onLoadBegin: PropTypes.func.isRequired,
		onLoadEnd: PropTypes.func.isRequired
	};
}

Zotero.DiskUsage = {
	libraryID: Zotero.Libraries.userLibraryID,

	onLoad() {
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
		let handleLoadBegin = () => document.querySelector('#loading-spinner').hidden = false;
		let handleLoadEnd = () => document.querySelector('#loading-spinner').hidden = true;
		ReactDOM.render(
			<IntlProvider locale={Zotero.locale} messages={Zotero.Intl.strings}>
				<DiskUsageTable
					libraryID={id}
					onLoadBegin={handleLoadBegin}
					onLoadEnd={handleLoadEnd}
				/>
			</IntlProvider>,
			container
		);
	}
};
