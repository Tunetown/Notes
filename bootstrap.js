/**
 * Note taking app - Main application controller class.  
 * 
 * (C) Thomas Weber 2024 tom-vibrant@gmx.de
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>. 
 */

"use strict";

/**
 * Defines all needed resources.
 */
const APP_SOURCE_DEFINITIONS = [

	/**
	 * Files only to be included in the Service Worker pre-cache (not to be parsed on the page itself)
	 */
	{ src: './' },
  	{ src: './index.html' },
	
	{ src: './manifest.json' },
	{ src: './bootstrap.js' },
	
	{ src: './ui/app/images/favicon.ico' },
	{ src: './ui/app/images/NotesLogo_180.png' },
	{ src: './ui/app/images/NotesLogo_192.png' },
	{ src: './ui/app/images/NotesLogo_48.png' },
	{ src: './ui/app/images/NotesLogo_512.png' },
	{ src: './ui/app/images/NotesLogo_96.png' },

	{ src: './ui/app/doc/index.html' },
	{ src: './ui/app/doc/overview.html' },
	{ src: './ui/app/doc/technical.html' },
	{ src: './ui/app/doc/usage.html' },

    { src: './ui/lib/client-zip.js' },
    
    { src: './ui/lib/codemirror/mode/markdown/markdown.js' },
	{ src: './ui/lib/codemirror/mode/clike/clike.js' },
	{ src: './ui/lib/codemirror/mode/css/css.js' },
	{ src: './ui/lib/codemirror/mode/xml/xml.js' },
	{ src: './ui/lib/codemirror/mode/php/php.js' },
	{ src: './ui/lib/codemirror/mode/python/python.js' },
	{ src: './ui/lib/codemirror/mode/ruby/ruby.js' },
	{ src: './ui/lib/codemirror/mode/shell/shell.js' },
	{ src: './ui/lib/codemirror/mode/sql/sql.js' },

	/**
	 * Library CSS and fonts
	 */
	{ src: './ui/lib/selectize/selectize.bootstrap3.min.css', tag: 'link', type: 'stylesheet' },
    { src: './ui/lib/bootstrap/bootstrap.min.css', tag: 'link', type: 'stylesheet' },
	{ src: './ui/lib/fa/css/all.min.css', tag: 'link', type: 'stylesheet' },
	{ src: './ui/lib/tinymce/skins/ui/oxide/skin.min.css', tag: 'link', type: 'stylesheet' },
    { src: './ui/lib/tinymce/skins/ui/oxide/content.min.css', tag: 'link', type: 'stylesheet' },
    { src: './ui/lib/tinymce/skins/content/default/content.min.css', tag: 'link', type: 'stylesheet' },
    { src: './ui/lib/switch/switch.css', tag: 'link', type: 'stylesheet' },
    { src: './ui/lib/codemirror/lib/codemirror.css', tag: 'link', type: 'stylesheet' },
    { src: './ui/lib/codemirror/addon/hint/show-hint.css', tag: 'link', type: 'stylesheet' },
    { src: './ui/lib/neo4j/css/neo4jd3.css', tag: 'link', type: 'stylesheet' },
    	
	{ src: './ui/lib/fa/webfonts/fa-solid-900.woff2', tag: 'link', type: 'font/woff2' },
	{ src: './ui/lib/fa/webfonts/fa-regular-400.woff2', tag: 'link', type: 'font/woff2' },

	/**
	 * App CSS
	 */
    { src: './ui/app/css/Notes.css', tag: 'link', type: 'stylesheet' },
    { src: './ui/app/css/Header.css', tag: 'link', type: 'stylesheet' },
    { src: './ui/app/css/NoteTree.css', tag: 'link', type: 'stylesheet' },
    { src: './ui/app/css/TreeBehaviour.css', tag: 'link', type: 'stylesheet' },
    { src: './ui/app/css/DetailBehaviour.css', tag: 'link', type: 'stylesheet' },
    { src: './ui/app/css/ReferenceBehaviour.css', tag: 'link', type: 'stylesheet' },
    { src: './ui/app/css/Misc.css', tag: 'link', type: 'stylesheet' },
    { src: './ui/app/css/BoardEditor.css', tag: 'link', type: 'stylesheet' },
    { src: './ui/app/css/RichtextEditor.css', tag: 'link', type: 'stylesheet' },
    
	/**
	 * Library JS
	 */
	{ src: './ui/lib/jquery-min.js', tag: 'script', type: 'text/javascript' },      
    
    { src: './ui/lib/codemirror/lib/codemirror.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/codemirror/mode/javascript/javascript.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/codemirror/addon/hint/show-hint.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/codemirror/addon/mode/overlay.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/bootstrap/bootstrap.min.js', tag: 'script', type: 'text/javascript' },     
    { src: './ui/lib/tinymce/tinymce.min.js', tag: 'script', type: 'text/javascript' },
	{ src: './ui/lib/muuri/muuri.min.js', tag: 'script', type: 'text/javascript' },
	{ src: './ui/lib/pouchdb/pouchdb.min.js', tag: 'script', type: 'text/javascript' },
	{ src: './ui/lib/pouchdb/pouchdb.find.min.js', tag: 'script', type: 'text/javascript' },
	{ src: './ui/lib/pouchdb/pouchdb.authentication.min.js', tag: 'script', type: 'text/javascript' },
	{ src: './ui/lib/FileSaver/FileSaver.min.js', tag: 'script', type: 'text/javascript' },
	{ src: './ui/lib/switch/switch.js', tag: 'script', type: 'text/javascript' },
	{ src: './ui/lib/showdown/showdown.min.js', tag: 'script', type: 'text/javascript' },
	{ src: './ui/lib/jsdiff.min.js', tag: 'script', type: 'text/javascript' },
	{ src: './ui/lib/sammy-latest.min.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/selectize/selectize.min.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/jquery.color-2.1.2.min.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/neo4j/js/neo4jd3.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/neo4j/js/d3.min.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/detect-element-resize.js', tag: 'script', type: 'text/javascript' },
    
    { src: './ui/lib/tinymce/themes/silver/theme.min.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/tinymce/icons/default/icons.min.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/tinymce/plugins/code/plugin.min.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/tinymce/plugins/table/plugin.min.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/tinymce/plugins/image/plugin.min.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/tinymce/plugins/lists/plugin.min.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/tinymce/plugins/advlist/plugin.min.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/tinymce/plugins/charmap/plugin.min.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/tinymce/plugins/codesample/plugin.min.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/tinymce/plugins/emoticons/plugin.min.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/tinymce/plugins/emoticons/js/emojis.min.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/tinymce/plugins/fullscreen/plugin.min.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/tinymce/plugins/hr/plugin.min.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/tinymce/plugins/imagetools/plugin.min.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/tinymce/plugins/link/plugin.min.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/tinymce/plugins/media/plugin.min.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/tinymce/plugins/print/plugin.min.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/tinymce/plugins/searchreplace/plugin.min.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/tinymce/plugins/textpattern/plugin.min.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/lib/tinymce/plugins/toc/plugin.min.js', tag: 'script', type: 'text/javascript' },
    
    { src: './ui/lib/localstorage-slim/localstorage-slim.js', tag: 'script', type: 'text/javascript' },

    /**
	 * App JS
	 */
    { src: './ui/app/src/actions/AttachmentActions.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/actions/BoardActions.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/actions/DocumentActions.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/actions/EditorActions.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/actions/HistoryActions.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/actions/ReferenceActions.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/actions/SettingsActions.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/actions/TrashActions.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/actions/NavigationActions.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/actions/MetaActions.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/actions/HashtagActions.js', tag: 'script', type: 'text/javascript' },
    
    { src: './ui/app/src/database/Database.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/database/DatabaseSync.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/database/ProfileHandler.js', tag: 'script', type: 'text/javascript' },
    
    { src: './ui/app/src/data/Data.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/data/Graph.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/data/Linkage.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/data/Hashtag.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/data/Document.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/data/DocumentAccess.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/data/DocumentChecks.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/data/Views.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/data/Generator.js', tag: 'script', type: 'text/javascript' },
    
    { src: './ui/app/src/navigation/behaviours/TreeBehaviour.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/navigation/behaviours/DetailBehaviour.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/navigation/NoteTree.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/navigation/Behaviours.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/navigation/MuuriGrid.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/navigation/ScrollState.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/navigation/ExpandedState.js', tag: 'script', type: 'text/javascript' },
    
    { src: './ui/app/src/menus/PageMenu.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/menus/ContextMenu.js', tag: 'script', type: 'text/javascript' },
    
    { src: './ui/app/src/settings/Settings.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/settings/SettingsContent.js', tag: 'script', type: 'text/javascript' },
    
    { src: './ui/app/src/view/pages/base/Page.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/pages/base/Editor.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/pages/base/RestorableEditor.js', tag: 'script', type: 'text/javascript' },

    { src: './ui/app/src/view/pages/editors/RichtextEditor.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/pages/editors/BoardEditor.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/pages/editors/CodeEditor.js', tag: 'script', type: 'text/javascript' },
    
    { src: './ui/app/src/view/View.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/MessageHandler.js', tag: 'script', type: 'text/javascript' },

    { src: './ui/app/src/view/dialog/Dialog.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/dialog/Dialogs.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/dialog/ImageDialog.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/dialog/CreateDialog.js', tag: 'script', type: 'text/javascript' },
    
    { src: './ui/app/src/view/pages/ProfilesPage.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/pages/ConflictPage.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/pages/ConflictsPage.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/pages/HashtagsPage.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/pages/VersionsPage.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/pages/VersionPage.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/pages/AttachmentPage.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/pages/ConsolePage.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/pages/TrashPage.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/pages/RawPage.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/pages/GraphPage.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/pages/SettingsPage.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/pages/CheckPage.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/pages/CheckList.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/pages/RefsPage.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/pages/HelpPage.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/pages/UpdatePage.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/pages/GeneratePage.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/view/pages/VerifyBackupPage.js', tag: 'script', type: 'text/javascript' },
    
    { src: './ui/app/src/import/Import.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/import/NotesImporter.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/import/TrelloImporter.js', tag: 'script', type: 'text/javascript' },

    { src: './ui/app/src/export/NotesExporter.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/export/ObsidianExporter.js', tag: 'script', type: 'text/javascript' },

    { src: './ui/app/src/tools/Tools.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/tools/TouchClickHandler.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/tools/ClientState.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/tools/OnlineSensor.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/tools/Callbacks.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/tools/Styles.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/tools/HistoryHandler.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/tools/Device.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/tools/Console.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/tools/ErrorHandler.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/tools/Errors.js', tag: 'script', type: 'text/javascript' },

    { src: './ui/app/src/Config.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/Routing.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/Tab.js', tag: 'script', type: 'text/javascript' },
    { src: './ui/app/src/Notes.js', tag: 'script', type: 'text/javascript' },

];

/////////////////////////////////////////////////////////////////////////////////

/**
 * Source loader implementation, supporting both front end and service 
 * worker usage.
 */
class SourceLoader {

	/**
	 * List of files to cache for the SW
	 */
	precacheUrls = [];
	
	/**
	 * Load and parse all sources for use in the application.
	 * 
	 * @param {array} definitions
	 */
	load(definitions) {
		this.#checkDefinitions(definitions);
		
		const that = this;
		definitions.forEach(function(entry) {
			if (!entry.hasOwnProperty('tag')) return;
			if (!entry.hasOwnProperty('type')) return;
			
			switch(entry.tag) {
				case 'script': 
					that.#requireScript(entry);
					break;
					
				case 'link': 
					that.#requireLink(entry);
					break;
					
				default:
					throw new Error('Invalid file tag: ' + entry.tag);
			}
		});
	}
	
	/**
	 * Create the precache list for the SW. The list is stored
	 * in attribute precacheUrls, which will be read later by the worker.
	 * 
	 * @param {array} definitions
	 */
	createPrecacheList(definitions) {
		const that = this;
		definitions.forEach(function(entry) {
			if (!entry.hasOwnProperty('src')) throw new Error('No src defined');
			
			that.precacheUrls.push(entry.src);
		});
	}
	
	/**
	 * Load a script.
	 */
	#requireScript(definition) {
		if (!definition.hasOwnProperty('src')) throw new Error('No src defined');
		var scriptTag = document.createElement("script");
		
		scriptTag.src = definition.src;
		scriptTag.type = definition.type;
		scriptTag.async = false;
		
		document.head.append(scriptTag);
	}
	
	/**
	 * Load a resource via link (css/fints etc.).
	 */
	#requireLink(definition) {
		if (!definition.hasOwnProperty('src')) throw new Error('No src defined');
		var linkTag = document.createElement("link");
		
		linkTag.href = definition.src;
		linkTag.rel = definition.type;
		
		document.head.append(linkTag);
	}
	
	/**
	 * Check correctness of definitions
	 */
	#checkDefinitions(definitions) {
		definitions.forEach(function(entry) {
			// Check each source only exists once
			var cnt = 0;
			definitions.forEach(function(entryDbl) {
				if (entry.src == entryDbl.src) ++cnt;
			});
			
			if (cnt != 1) throw new Error('Duplicate source: ' + entry.src + ' appears ' + cnt + ' times');
		});
	}
}

///////////////////////////////////////////////////////////////////////////////////

const SOURCE_LOADER = new SourceLoader();

if (typeof document !== 'undefined') {
	// In case this file has been included by the frontent, load all scripts.
	SOURCE_LOADER.load(APP_SOURCE_DEFINITIONS);
} else {
	// Loaded by the Service Worker: Create plain array of all sources, which 
	// are then pre-cached by the worker.
	SOURCE_LOADER.createPrecacheList(APP_SOURCE_DEFINITIONS);
}

///////////////////////////////////////////////////////////////////////////////////

if (typeof window !== 'undefined') {
	window.onload = function() {
		new Notes().run(); 
	}
}


