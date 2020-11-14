/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2020 Corporation for Digital Scholarship
                     Vienna, Virginia, USA
                     https://digitalscholar.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/

'use strict';

import React, { memo, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage, useIntl } from 'react-intl';

import SearchConditionTextbox from './search/searchConditionTextbox.js';
import SearchConditionDropdown from './search/searchConditionDropdown.js';
import SearchConditionDate from './search/searchConditionDate.js';


function SearchBox({ searchObject, onLibraryChange, refresh, onCommand }) {
	const intl = useIntl();

	// Library Section

	const [libraryID, setLibraryID] = useState(String(searchObject.libraryID ? searchObject.libraryID : '1'));

	// Whenever the selected library changes
	const handleLibraryChange = (e) => {
		setLibraryID(e.target.value);
		onLibraryChange(e.target.value);
	};

	useEffect(() => {
		onLibraryChange(libraryID);
	}, []);

	// Search Conditions Section
	
	const [conditions, setConditions] = useState(searchObject.getConditions());

	const handleAddCondition = (condition) => {
		if (condition) {
			searchObject.addCondition(
				condition.condition,
				condition.operator,
				''
			);
		}
		else {
			searchObject.addCondition(
				'title',
				'contains',
				''
			);
		}
		setConditions(searchObject.getConditions());
		// TODO: window.sizeToContent();
	};

	const handleRemoveCondition = (conditionID) => {
		searchObject.removeCondition(conditionID);
		setConditions(searchObject.getConditions());
		// TODO: window.sizeToContent();
	};

	const handleConditionChange = (conditionID, condition, operator, value) => {
		// Change the operator value if it is no longer valid for the new condition
		const operators = Zotero.SearchConditions.get(condition).operators;
		if (!Object.keys(operators).includes(operator)) {
			operator = Object.keys(operators)[0];
		}
		// TODO: Switching condition/operator may need to reset value
		searchObject.updateCondition(conditionID, condition, operator, value);
		setConditions(searchObject.getConditions());
	};

	const handleValueChange = (conditionID, value) => {
		searchObject.updateCondition(
			conditionID,
			conditions[conditionID].condition,
			conditions[conditionID].operator,
			value
		);
		setConditions(searchObject.getConditions());
	};

	// Special conditions

	const joinModeCondition = 'joinMode';
	const recursiveCondition = 'recursive';
	const noChildrenCondition = 'noChildren';
	const includeParentsAndChildrenCondition = 'includeParentsAndChildren';

	const [joinModeID, setJoinModeID] = useState(Object.keys(conditions)
		.find(conditionID => conditions[conditionID].condition === joinModeCondition));
	const [recursiveID, setRecursiveID] = useState(Object.keys(conditions)
		.find(conditionID => conditions[conditionID].condition === recursiveCondition));
	const [noChildrenID, setNoChildrenID] = useState(Object.keys(conditions)
		.find(conditionID => conditions[conditionID].condition === noChildrenCondition));
	const [includeParentsAndChildrenID, setIncludeParentsAndChildrenID] = useState(Object.keys(conditions)
		.find(conditionID => conditions[conditionID].condition === includeParentsAndChildrenCondition));
	
	const handleSpecialCondition = (conditionName, conditionID, value, setConditionID) => {
		if (conditionID) {
			searchObject.updateCondition(
				conditionID,
				conditionName,
				value,
				null
			);
			setConditions(searchObject.getConditions());
		}
		else {
			setConditionID(searchObject.addCondition(
				conditionName,
				value,
				null
			));
			setConditions(searchObject.getConditions());
		}
	};

	const [refreshState, setRefreshState] = useState(refresh);
	if (refreshState != refresh) {
		// Code outside react is telling us that it may have updated our properties so we need
		// to update our state. This is very much an anti-pattern in React because we lose
		// all the state that currently exists, which can be dangerous. In this case, we are
		// using it for the Clear button so it's not as big of a worry.
		setConditions(searchObject.getConditions());
		setJoinModeID(Object.keys(conditions)
			.find(conditionID => conditions[conditionID].condition === joinModeCondition));
		setRecursiveID(Object.keys(conditions)
			.find(conditionID => conditions[conditionID].condition === recursiveCondition));
		setNoChildrenID(Object.keys(conditions)
			.find(conditionID => conditions[conditionID].condition === noChildrenCondition));
		setIncludeParentsAndChildrenID(Object.keys(conditions)
			.find(conditionID => conditions[conditionID].condition === includeParentsAndChildrenCondition));
		// Note: Library ID does not change so we don't reset it here
		setRefreshState(refresh);
	}

	// Key press handler for entire search box
	const handleKeyPress = (e) => {
		if (e.key === 'Enter') {
			if (e.shiftKey) {
				handleAddCondition();
			}
			else {
				onCommand();
			}
		}
	};

	return (
		<div
			id="search-box"
			className="search-box"
			onKeyPress={ handleKeyPress }
		>
			{/* Library Select */}
			<div>
				<label htmlFor="libraryMenu">
					<FormattedMessage id="zotero.search.searchInLibrary" />
				</label>
				
				<select
					id="libraryMenu"
					value={ libraryID }
					disabled={ searchObject.name }
					onChange={ handleLibraryChange }
				>
					{ Zotero.Libraries.getAll().map(library => (
						<option
							key={ library.libraryID }
							value={ library.libraryID }
							data-editable={ library.editable ? 'true' : 'false' }
							data-fileseditable={ library.filesEditable ? 'true' : 'false' }
							data-selected={ libraryID === library.libraryID }
						>
							{ library.name }
						</option>
					)) }
				</select>
			</div>

			<div className="search-box-conditions">
				{/* Match Select */}
				<div className="flex-row-center">
					<label>
						<FormattedMessage id="zotero.search.joinMode.prefix" />
					</label>

					<select
						id="joinModeMenu"
						value={ joinModeID ? conditions[joinModeID].operator : 'all' }
						onChange={
							e => handleSpecialCondition(
								joinModeCondition,
								joinModeID,
								e.currentTarget.value,
								setJoinModeID
							)
						}
					>
						<option
							label={ intl.formatMessage({ id: 'zotero.search.joinMode.any' }) }
							value="any"
						>
							{ intl.formatMessage({ id: 'zotero.search.joinMode.any' }) }
						</option>
						<option
							label={ intl.formatMessage({ id: 'zotero.search.joinMode.all' }) }
							value="all"
						>
							{ intl.formatMessage({ id: 'zotero.search.joinMode.all' }) }
						</option>
					</select>

					<label>
						<FormattedMessage id="zotero.search.joinMode.suffix" />
					</label>
				</div>

				<div
					id="conditions"
					className="search-conditions"
				>
					{ Object.keys(conditions).map((conditionID) => {
						const condition = conditions[conditionID];

						if (condition.condition === joinModeCondition
							|| condition.condition === recursiveCondition
							|| condition.condition === noChildrenCondition
							|| condition.condition === includeParentsAndChildrenCondition) {
							return '';
						}

						let valueSection = <SearchConditionTextbox
							condition={ condition }
							onModeChange={ (e) => {
								// Don't use handleConditionChange because we don't want
								// the operator check
								searchObject.updateCondition(
									conditionID,
									condition.condition + '/' + e.target.value,
									condition.operator,
									condition.value
								);
								setConditions(searchObject.getConditions());
							} }
							onValueChange={ value => handleValueChange(conditionID, value) }
						/>;
						if (condition.condition === "collection"
							|| condition.condition === "savedSearch"
							|| condition.condition === "itemType"
							|| condition.condition === "fileTypeID") {
							valueSection = <SearchConditionDropdown
								libraryID={ libraryID }
								condition={ condition.condition }
								savedSearchID={ searchObject.id }
								value={ condition.value }
								onValueChange={ (newCondition, value) => {
									searchObject.updateCondition(
										conditionID,
										newCondition,
										conditions[conditionID].operator,
										value
									);
									setConditions(searchObject.getConditions());
								} }
							/>;
						}
						else if (condition.operator === "isInTheLast") {
							valueSection = <SearchConditionDate
								value={ condition.value }
								onValueChange={ value => handleValueChange(conditionID, value) }
							/>;
						}

						const operators = Zotero.SearchConditions.get(condition.condition).operators;

						return (
							<div
								key={ conditionID }
								className="search-condition flex-row-center"
							>
								<select
									id="conditionsmenu"
									value={ condition.condition === "savedSearch" ? "collection" : condition.condition }
									onChange={ e => handleConditionChange(conditionID, e.target.value, condition.operator, condition.value) }
								>
									{ Zotero.SearchConditions.getStandardConditions().map(
										(condition, index) => {
											return (
												<option
													key={ index }
													value={ condition.name }
												>
													{ condition.localized }
												</option>
											);
										}
									) }
								</select>

								<select
									id="operatorsmenu"
									value={ condition.operator }
									onChange={ e => handleConditionChange(conditionID, condition.condition, e.target.value, condition.value) }
								>
									{ Object.keys(operators).map((operator) => {
										return (
											<option
												key={ operator }
												value={ operator }
											>
												{ Zotero.getString("searchOperator." + operator) }
											</option>
										);
									}) }
								</select>

								{ valueSection }

								<label
									id="remove"
									className="zotero-clicky zotero-clicky-minus"
									value="-"
									disabled={ Object.keys(conditions).length === 1 }
									onClick={ (_) => {
										if (Object.keys(conditions).length !== 1) {
											handleRemoveCondition(conditionID);
										}
									} }
								/>

								<label
									id="add"
									className="zotero-clicky zotero-clicky-plus"
									value="+"
									onClick={ _ => handleAddCondition(condition) }
								/>
							</div>
						);
					}) }
				</div>
			</div>

			<div className="flex-row-center">
				<input
					type="checkbox"
					id="recursiveCheckbox"
					onChange={
						e => handleSpecialCondition(
							recursiveCondition,
							recursiveID,
							e.target.checked,
							setRecursiveID
						)
					}
				/>
				<label htmlFor="recursiveCheckbox">
					<FormattedMessage id="zotero.search.recursive.label" />
				</label>
				<input
					type="checkbox"
					id="noChildrenCheckbox"
					onChange={
						e => handleSpecialCondition(
							noChildrenCondition,
							noChildrenID,
							e.target.checked,
							setNoChildrenID
						)
					}
				/>
				<label htmlFor="noChildrenCheckbox">
					<FormattedMessage id="zotero.search.noChildren" />
				</label>
			</div>

			<div className="flex-row-center">
				<input
					type="checkbox"
					id="includeParentsAndChildrenCheckbox"
					onChange={
						e => handleSpecialCondition(
							includeParentsAndChildrenCondition,
							includeParentsAndChildrenID,
							e.target.checked,
							setIncludeParentsAndChildrenID
						)
					}
				/>
				<label htmlFor="includeParentsAndChildrenCheckbox">
					<FormattedMessage id="zotero.search.includeParentsAndChildren" />
				</label>
			</div>

		</div>
	);
}


SearchBox.propTypes = {
	searchObject: PropTypes.object,
	onLibraryChange: PropTypes.func,
	refresh: PropTypes.bool,
	onCommand: PropTypes.func
};


SearchBox.defaultProps = {
	onLibraryChange: () => {},
	refresh: false,
	onCommand: () => {}
};


export default memo(SearchBox);
