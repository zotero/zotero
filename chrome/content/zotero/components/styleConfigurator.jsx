/*
	***** BEGIN LICENSE BLOCK *****
	
	Copyright © 2021 Corporation for Digital Scholarship
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

import PropTypes from 'prop-types';
import React, { useCallback, useEffect, memo, useMemo, useRef, useState } from 'react';

import RadioSet from './radioSet';
import { noop, nextHTMLID, stopPropagation } from './utils';


const StyleSelector = memo(({ id, onStyleChange = noop, style }) => {
	const styles = useMemo(() => Zotero.Styles.getVisible().map((so) => {
		const value = so.styleID;
		// Add acronyms to APA and ASA to avoid confusion
		// https://forums.zotero.org/discussion/comment/357135/#Comment_357135
		const label = so.title
			.replace(/^American Psychological Association/, "American Psychological Association (APA)")
			.replace(/^American Sociological Association/, "American Sociological Association (ASA)");

		return { value, label };
	}), []);

	const handleChange = useCallback((ev) => {
		onStyleChange(ev.currentTarget.value);
	}, [onStyleChange]);

	return (
		<select
			id={ id }
			onChange={ handleChange }
			onKeyDown={ stopPropagation }
			size="10"
			value={ style }
		>
			{ styles.map(({ value, label }) => (
				<option key={ value } value={ value } >{ label }</option>
			))}
		</select>
	);
});

StyleSelector.propTypes = {
	id: PropTypes.string,
	onStyleChange: PropTypes.func,
	style: PropTypes.string,
};

StyleSelector.displayName = 'StyleSelector';


const LocaleSelector = memo(({ id, locale, onLocaleChange = noop, style }) => {
	const locales = useMemo(() => {
		const fallbackLocale = Zotero.Styles.primaryDialects[Zotero.locale]
			|| Zotero.locale;
		
		const menuLocales = Zotero.Utilities.deepCopy(Zotero.Styles.locales);
		const menuLocalesKeys = Object.keys(menuLocales).sort();
		
		
		// Make sure that client locale is always available as a choice
		if (fallbackLocale && !(fallbackLocale in menuLocales)) {
			menuLocales[fallbackLocale] = fallbackLocale;
			menuLocalesKeys.unshift(fallbackLocale);
		}

		return menuLocalesKeys.map(value => ({ value, label: menuLocales[value] }));
	}, []);

	const styleData = style ? Zotero.Styles.get(style) : null;

	const handleChange = useCallback((ev) => {
		onLocaleChange(ev.currentTarget.value);
	}, [onLocaleChange]);

	return (
		<select
			disabled={ !style || styleData.locale }
			id={ id }
			onChange={ handleChange }
			onKeyDown={ stopPropagation }
			value={ styleData && styleData.locale || locale }
		>
			{ locales.map(({ value, label }) => (
				<option key={ value } value={ value } >{ label }</option>
			))}
		</select>
	);
});

LocaleSelector.propTypes = {
	id: PropTypes.string,
	locale: PropTypes.string,
	onLocaleChange: PropTypes.func,
	style: PropTypes.string,
};

LocaleSelector.displayName = 'LocaleSelector';

const defaultSupportedNotes = ['footnotes', 'endnotes'];

const StyleConfigurator = memo(({ onStyleConfigChange = noop, supportedNotes = defaultSupportedNotes, ...otherProps }) => {
	const [style, setStyle] = useState(otherProps.style || Zotero.Prefs.get('export.lastStyle'));
	const [locale, setLocale] = useState(otherProps.locale || Zotero.Prefs.get('export.lastLocale'));
	const [displayAs, setDisplayAs] = useState(otherProps.displayAs || 'footnotes');
	const [isReady, setIsReady] = useState(false);

	const htmlID = useRef(nextHTMLID());

	const options = [
		{ label: Zotero.getString('integration.prefs.footnotes.label'), value: 'footnotes' },
		{ label: Zotero.getString('integration.prefs.endnotes.label'), value: 'endnotes' }
	];

	const styleData = (style && isReady) ? Zotero.Styles.get(style) : null;
	const isNoteStyle = (styleData || {}).class === 'note';

	const handleStyleChange = useCallback((newStyle) => {
		setStyle(newStyle);
		onStyleConfigChange({ style: newStyle, locale, displayAs });
	}, [displayAs, locale, onStyleConfigChange]);

	const handleLocaleChange = useCallback((newLocale) => {
		setLocale(newLocale);
		onStyleConfigChange({ style, locale: newLocale, displayAs });
	}, [displayAs, onStyleConfigChange, style]);

	const handleDisplayAsChange = useCallback((newDisplayAs) => {
		setDisplayAs(newDisplayAs);
		onStyleConfigChange({ style, locale, displayAs: newDisplayAs });
	}, [locale, onStyleConfigChange, style]);

	useEffect(() => {
		(async () => {
			await Zotero.Styles.init();
			setIsReady(true);
		})();
	}, []);

	return (
		<div className="style-configurator">
			{ isReady && (
				<React.Fragment>
					<div className="style-selector-wrapper">
						<label htmlFor={ htmlID.current + '-style-selector' }>
							{ Zotero.getString('bibliography.style.label') }
						</label>
						<div className="style-selector-input-wrapper">
							<StyleSelector
								id={ htmlID.current + '-style-selector' }
								style={ style }
								onStyleChange={ handleStyleChange }
							/>
						</div>
					</div>
					<div className="locale-selector-wrapper">
						<label htmlFor={ htmlID.current + '-locale-selector' }>
							{ Zotero.getString('bibliography.locale.label') }
						</label>
						<LocaleSelector
							id={ htmlID.current + '-locale-selector' }
							locale={ locale }
							onLocaleChange={ handleLocaleChange }
							style={ style }
						/>
					</div>
					{ (supportedNotes.length > 1 && !isNoteStyle) && (
						<div className="display-as-wrapper">
							<label>{ Zotero.getString('integration.prefs.displayAs.label') }</label>
							<div className="display-as-input-wrapper">
								<RadioSet
									onChange={ handleDisplayAsChange }
									onKeyDown={ stopPropagation }
									options={ options }
									value={ displayAs }
								/>
							</div>
						</div>
					)}
				</React.Fragment>
			)}
		</div>
	);
});

StyleConfigurator.displayName = 'StyleConfigurator';

StyleConfigurator.propTypes = {
	onStyleConfigChange: PropTypes.func,
	supportedNotes: PropTypes.array,
};


export { LocaleSelector, StyleSelector };
export default StyleConfigurator;
