/**
 * Configuration
 * 
 * (C) Thomas Weber 2021 tom-vibrant@gmx.de
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
class Config {};
	
/**
 * Settings defaults (notebook settings, stored per notebook in the database as settings document)
 */
Config.defaultThemeColor = "#ff8080";
Config.defaultTextColor = "#06feab";

Config.defaultAutosaveIntervalSecs = 3;

Config.defaultNotebookName = 'New Notebook';

Config.defaultEditorMode = 'code';
Config.defaultPlainTextMode = 'markdown';

Config.defaultAskBeforeMoving = false;
Config.defaultMaxUploadSizeMB = 1;
Config.defaultReduceHistory = true;
Config.defaultMaxSearchResults = 20;
Config.defaultShowAttachedImageAsItemBackground = true;
	
/**
 * Default local settings
 */	
Config.defaultHeaderSizeDesktop = 40;
Config.defaultHeaderSizeMobile = 35 ;
Config.minHeaderSize = 20;

Config.defaultButtonSizeDesktop = 18;
Config.defaultButtonSizeMobile = 20;
Config.minButtonSize = 10;

Config.defaultFooterSizeMobile = 42;
Config.minFooterSize = 20;

Config.defaultNavigationTextSizeDesktop = 18;
Config.defaultNavigationTextSizeMobile = 22;
Config.minNavigationTextSize = 10;

Config.minDetailNavigationItemHeight = 10;

Config.defaultDetailNavigationAnimationDurationDesktop = 60;
Config.defaultDetailNavigationAnimationDurationMobile = 100;
Config.minDetailNavigationAnimationDuration = 10;

Config.defaultFavoritesSize = 65;
Config.defaultFavoritesAmount = 20;
Config.minFavoritesSize = 20;

/**
 * Name of the root node if it needs to be shown to the user. Leave this 
 * empty for normal usage.
 */
Config.ROOT_NAME = 'Notebook Home';

/**
 * Offset for the context option menus, seen from the event cursor position.
 */
Config.CONTEXT_OPTIONS_XOFFSET = 0;
Config.CONTEXT_OPTIONS_YOFFSET = 30;

/**
 * Maximum number of characters used for document select options on mobile devices.
 * This is necessary because most mobile devices show select inputs natively at
 * the bottom of the screen, not allowing the visible text to be too long.
 * 
 * On Desktops, always the full values are shown, this is only used 
 * if Notes.isMobile() is true.
 */
Config.MOBILE_MAX_SELECTOPTION_LENGTH = 40;

/**
 * Fade out times for message types. set to 0 to disable.
 */
Config.MESSAGE_INFO_FADEOUT_AFTER_MS = 3000;
Config.MESSAGE_SUCCESS_FADEOUT_AFTER_MS = 3000;
Config.MESSAGE_WARNING_FADEOUT_AFTER_MS = 12000;
Config.MESSAGE_ERROR_FADEOUT_AFTER_MS = 12000;
Config.MESSAGE_OTHERS_FADEOUT_AFTER_MS = 12000;

/**
 * Properties for item background images (these will be rescaling)
 */
Config.ITEM_BACKGROUND_MIME_TYPE = 'image/jpeg';
Config.ITEM_BACKGROUND_QUALITY = 0.4;
Config.ITEM_BACKGROUND_MAX_WIDTH = 400;
Config.ITEM_BACKGROUND_MAX_HEIGHT = 400;
Config.ITEM_BACKGROUND_DONT_RESCALE_BELOW_BYTES = 50 * 1024;  

/**
 * Properties for board background images (these will be rescaling)
 */
Config.BOARD_BACKGROUND_MAX_WIDTH = 1000;
Config.BOARD_BACKGROUND_MAX_HEIGHT = 1000;
Config.BOARD_BACKGROUND_MIME_TYPE = 'image/jpeg';
Config.BOARD_BACKGROUND_QUALITY = 0.4;
Config.BOARD_BACKGROUND_DONT_RESCALE_BELOW_BYTES = 500 * 1024;

/**
 * Background color for graph view
 */
Config.graphBackgroundColor = '#555';

/**
 * Properties for search in navigation
 */
Config.maxSearchProposals = 10;

/**
 * Version options
 */
Config.versionRestoreImmediately = true;     // When selecting a version in history view, immediately load it into the editor if the editor supports restoring versions.

/**
 * Options for large notebooks
 */
Config.dontCheckConflictsGloballyBeyondNumRecords = 6000;  // When the notebook contains more than this amount of documents, no global conflict checking will be done. 
                                                           // In this case, no warning is shown at the user menu icon and in navigation, you have to call the conflicts 
                                                           // page to view the conflicts in the notebook manually.

/**
 * Options for hashtags and links in document contents
 */
Config.defaultHashtagColor = '#008800';      // Only hash colors allowed!
Config.tagNameColorProposals = [
	{ color: '#00dd00', token: 'compl' },
	{ color: '#00dd00', token: 'ok' },
	{ color: '#00dd00', token: 'done' },
	{ color: '#00dd00', token: 'succ' },
	
	{ color: '#ff9900', token: 'todo' },
	{ color: '#ff9900', token: 'tbd' },
	{ color: '#ff9900', token: 'tbc' },

	{ color: '#ff0000', token: 'error' },
	{ color: '#ff0000', token: 'fail' },
];

/**
 * Focus of areas
 */
Config.focusColor = '#c40cf7';