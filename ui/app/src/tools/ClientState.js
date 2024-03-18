/**
 * Saves and restires the client side sstored state information (tree expansion, 
 * loaded note etc.)
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
class ClientState {

	#app = null;

	constructor(app) {
		this.#app = app;
		
		/**
		 * Internal IDs for different cookies
		 */
		this.cidTreeState = 'ts';
		this.cidProfiles = "pr";	
		this.cidConsoleSettings = "cs";	
		this.cidViewSettings = "vs";	
		this.cidTempViewSettings = "tvs";	
		this.cidEditorSettings = "es";	
		this.cidViewState = "vt";
		this.cidBoardState = "bt";
		this.cidMobileOverride = "mo";
		this.cidLastOpenedUrl = "lo";
		this.cidFavorites = "fa";
		this.cidGraphMeta = "gs";
		this.cidLinkages = "li";
		this.cidSearchProposals = "sp";
		this.cidExperimentalFunctions = "ex";
		this.cidLocalSettings = "se";
		this.cidUndoHistory = "ud";
		this.cidTrustedDeviceCredentials = "dc";
	}
	
	/**
	 * Local UI settings
	 */
	setLocalSettings(s) {
		this.setLocal(this.cidLocalSettings, s, true);
	}
	
	/**
	 * Local UI settings
	 */
	getLocalSettings() {
		return this.getLocal(this.cidLocalSettings, true);
	}
	
	/**
	 * Trusted device credentials
	 */
	setTrustedDeviceCredentials(usr, pwd) {		
		const data = (usr && pwd) ? {
			user: usr,
			password: pwd
		} : {};
		this.setLocalEncrypted(this.cidTrustedDeviceCredentials, data);
	}
	
	/**
	 * Trusted device credentials
	 */
	getTrustedDeviceCredentials() {
		return this.getLocalEncrypted(this.cidTrustedDeviceCredentials);
	}
	
	isDeviceTrusted() {
		const trustedCredentials = this.getTrustedDeviceCredentials();
		return trustedCredentials && trustedCredentials.user && trustedCredentials.password;		
	}

	/**
	 * Undo history: Set data.
	 */
	setUndoHistory(data) {
		this.setLocal(this.cidUndoHistory, data);
	}
	
	/**
	 * Undo history: Get data.
	 */
	getUndoHistory() {
		var history = this.getLocal(this.cidUndoHistory);
		if (!history.steps) {
			history.steps = [];
			history.position = -1;
			this.setUndoHistory(history);
		}
		return history;
	}
	
	/**
	 * Enables or disables an experimental function.
	 */
	enableExperimentalFunction(id, enable) {
		var f = this.getLocal(this.cidExperimentalFunctions, true);
		f[id] = enable;
		this.setLocal(this.cidExperimentalFunctions, f, true);
	}
	
	/**
	 * Returns if a given experimental function is enabled or not.
	 */
	experimentalFunctionEnabled(id) {
		var f = this.getLocal(this.cidExperimentalFunctions, true);
		return !!f[id];
	}
	
	/**
	 * Set a linkage mode for a given page.
	 */
	addSearchProposal(text) {
		if (!text) return;
		
		var data = this.getLocal(this.cidSearchProposals, true);
		if (!data) data = {};
		if (!data.proposals) data.proposals = [];
		
		// Check if there is a prefix of the text already in the array, in this case replace the entry.
		var found = false;
		for(var i in data.proposals) {
			// Repair damaged data
			if (typeof data.proposals[i] != 'object') {
				console.log('Repair search proposal: ' + data.proposals[i]);
				data.proposals[i] = { 
					token: data.proposals[i],
					timestamp: Date.now() 
				};
			}
			
			if (text.startsWith(data.proposals[i].token)) {
				// Extend the token and set on top
				data.proposals[i].token = text;
				data.proposals[i].timestamp = Date.now();
				found = true;
			} else if (data.proposals[i].token.startsWith(text)) {
				// Set the token on top
				data.proposals[i].timestamp = Date.now();
				found = true;
			}
		}
		
		// If not found, add new token
		if (!found) {
			data.proposals.push({
				token: text,
				timestamp: Date.now()
			})
		}
		
		// Sort by timestamp descending
		data.proposals.sort(function(a, b) {
			return b.timestamp - a.timestamp;
		});
		
		// Shorten if too much entries
		while (data.proposals.length > Config.maxSearchProposals) {
			data.proposals.pop();
		}
		
		this.setLocal(this.cidSearchProposals, {
			proposals: data.proposals
		}, true);
	}
	
	/**
	 * Returns the linkage mode for a given page ID, or false if not found.
	 */
	getSearchProposals() {
		var data = this.getLocal(this.cidSearchProposals, true);
		if (!data) return [];
		if (!data.proposals) return [];
		
		// Repair damaged data
		for(var i in data.proposals) {
			if (typeof data.proposals[i] != 'object') {
				console.log('Repair search proposal: ' + data.proposals[i]);
				data.proposals[i] = { 
					token: data.proposals[i],
					timestamp: Date.now() 
				};
			}
		}
		
		return data.proposals;
	}
	
	/**
	 * Set a linkage mode for a given page.
	 */
	setLinkageMode(pageId, mode) {
		var all = this.getLocal(this.cidLinkages, true);
		all[pageId] = mode;
		this.setLocal(this.cidLinkages, all, true);
	}
	
	/**
	 * Returns the linkage mode for a given page ID, or false if not found.
	 */
	getLinkageMode(pageId) {
		var all = this.getLocal(this.cidLinkages, true);
		if (!all) return false;
		if (!all[pageId]) return false;
		return all[pageId];
	}
	
	/**
	 * Saves the passed graph meta data for the passed ID.
	 */
	saveGraphMeta(id, data) {
		var all = this.getLocal(this.cidGraphMeta);
		if (!all || !all.entries) all = { entries: [] };
		
		var found = false;
		for(var i in all.entries) {
			if (all.entries[i].id == id) {
				all.entries[i].data = data;
				found = true;
				break;
			}
		}
		if (!found) {
			all.entries.push({
				id: id,
				data: data
			})
		}
		this.setLocal(this.cidGraphMeta, all);
	}
	
	/**
	 * Saves the passed global graph meta data.
	 */
	saveGlobalGraphMeta(data) {
		var all = this.getLocal(this.cidGraphMeta);
		all.global = data;
		this.setLocal(this.cidGraphMeta, all);
	}
	
	/**
	 * Returns graph meta data for the passed ID.
	 */
	getGraphMeta(id) {
		var all = this.getLocal(this.cidGraphMeta);
		if (!all || !all.entries) return {};
		
		for(var i in all.entries) {
			if (all.entries[i].id == id) {
				return all.entries[i].data;
			}
		}
		return {};
	}
	
	/**
	 * Returns global graph meta data.
	 */
	getGlobalGraphMeta(id) {
		var all = this.getLocal(this.cidGraphMeta);
		if (!all || !all.global) return {};
		return all.global;
	}
	
	/**
	 * Saves the passed favorites list.
	 */
	saveFavorites(f) {
		this.setLocal(this.cidFavorites, f);
	}
	
	/**
	 * Returns the passed favorites list.
	 */
	getFavorites() {
		var ret = this.getLocal(this.cidFavorites);
		return ret;
	}
	
	/**
	 * Returns the mobile override mode.
	 */
	getMobileOverride() {
		var ret = this.getLocal(this.cidMobileOverride, true);
		return ret.override;
	}
	
	/**
	 * Saves the passed mobile override mode.
	 */
	setMobileOverride(mode) {
		this.setLocal(this.cidMobileOverride, {
			override: mode
		}, true);
	}
	
	/**
	 * Returns the mobile override mode.
	 */
	getTouchAwareOverride() {
		var ret = this.getLocal(this.cidMobileOverride, true);
		return ret.overridetouch;
	}
	
	/**
	 * Saves the passed mobile override mode. Values: 'touch' or 'notouch'
	 */
	setTouchAwareOverride(mode) {
		this.setLocal(this.cidMobileOverride, {
			overridetouch: mode
		}, true);
	}
	
	/**
	 * Returns the URL of the last loaded page, or false if disabled.
	 */
	getLastOpenedUrl() {
		var ret = this.getLocal(this.cidLastOpenedUrl, true);
		return ret.enabled ? Routing.postProcessLastOpenedUrl(ret.url) : false;
	}
	
	/**
	 * Is the redirect enabled for the landing page?
	 */
	isLastOpenedUrlRedirectEnabled() {
		var state = this.getLocal(this.cidLastOpenedUrl, true);
		return state.enabled;
	}
	
	/**
	 * Saves the passed URL as the address of the last loaded page
	 */
	setLastOpenedUrl(url) {
		var state = this.getLocal(this.cidLastOpenedUrl, true);
		
		// If there is no data at all, we enable the function by default.
		if (!state.url) {
			state.enabled = true;
		}
		
		state.url = url;
		this.setLocal(this.cidLastOpenedUrl, state, true);
	}
	
	/**
	 * Enables redirect on landing page
	 */
	enableLastOpenedUrlRedirect(enabled) {
		var state = this.getLocal(this.cidLastOpenedUrl, true);
		state.enabled = enabled;
		this.setLocal(this.cidLastOpenedUrl, state, true);
	}
	
	/**
	 * Returns stored local view state
	 */
	getScrollState() {
		var ret = this.getLocal(this.cidViewState);
		return ret;
	}
	
	/**
	 * Saves the passed view state
	 */
	saveScrollState(p) {
		this.setLocal(this.cidViewState, p);
	}
	
	/**
	 * Returns stored local view state
	 */
	getBoardState() {
		var ret = this.getLocal(this.cidBoardState);
		return ret;
	}
	
	/**
	 * Saves the passed view state
	 */
	saveBoardState(p) {
		this.setLocal(this.cidBoardState, p);
	}
	
	/**
	 * Returns stored local view settings
	 */
	getViewSettings() {
		var ret = this.getLocal(this.cidViewSettings);

		if (!ret || !ret.initialized) {
			ret.detailHighlightLastSelected = true;
		}

		ret.initialized = true;
		
		if (!ret.navMode) ret.navMode = Behaviours.modeIdDetailRef;
		if (!ret.tileMaxSize) ret.tileMaxSize = 220;
		if (!ret.favoritesSize) ret.favoritesSize = Config.defaultFavoritesSize
		if (!ret.favoritesNum) ret.favoritesNum = Config.defaultFavoritesAmount;
		if (!ret.hasOwnProperty("dragDelayMillis")) ret.dragDelayMillis = Config.defaultDragDelayMillis;

		return ret;
	}
	
	/**
	 * Saves the passed view settings
	 */
	saveViewSettings(p) {
		this.setLocal(this.cidViewSettings, p);
	}
	
	/**
	 * Returns stored local temporary view settings
	 */
	getTemporaryViewSettings() {
		var ret = this.getLocal(this.cidTempViewSettings);
		return ret;
	}
	
	/**
	 * Saves the passed view settings
	 */
	saveTemporaryViewSettings(p) {
		this.setLocal(this.cidTempViewSettings, p);
	}

	/**
	 * Returns stored local editor settings
	 */
	getEditorSettings() {
		var ret = this.getLocal(this.cidEditorSettings);
		return ret;
	}
	
	/**
	 * Saves the passed editor settings
	 */
	saveEditorSettings(p) {
		this.setLocal(this.cidEditorSettings, p);
	}
	
	/**
	 * Returns all stored console settings
	 */
	getConsoleSettings() {
		var ret = this.getLocal(this.cidConsoleSettings, true);
		return ret;
	}
	
	/**
	 * Saves the passed console settings, replacing the old ones.
	 */
	saveConsoleSettings(p) {
		this.setLocal(this.cidConsoleSettings, p, true);
	}
	
	/**
	 * Returns all stored connection profiles
	 */
	getProfiles() {
		var ret = this.getLocal(this.cidProfiles, true);
		if (!ret.profiles) ret.profiles = [];
		
		// Create local profile
		var found = false;
		for(var p in ret.profiles) {
			if (ret.profiles[p].url == "local") {
				found = true;
			}
		}
		if (!found) {
			// Create local profile
			ret.profiles.push({
				url: "local"
			});
		}
		return ret;
	}
	
	/**
	 * Saves the passed connection profiles, replacing the old ones.
	 */
	saveProfiles(p) {
		this.setLocal(this.cidProfiles, p, true);
	}
	
	/**
	 * Saves the current tree state in a browser cookie.
	 */
	saveTreeState() {
		var state = this.getLocal(this.getTreeStateCid());
		
		this.#app.nav.behaviour.saveState(state);
		
		this.setLocal(this.getTreeStateCid(), state);
	}
	
	/**
	 * Returns the (tree mode dependent) CID for tree sexpanded states.
	 */
	getTreeStateCid() {
		return this.cidTreeState + '_' + this.getViewSettings().navMode; 
	}

	/**
	 * Loads a saved state from the cookie, and applies it to the tree.
	 */
	restoreTreeState() {
		var state = this.getTreeState();
	
		// Behaviour specific fields
		this.#app.nav.behaviour.restoreState(state);

		// Tree width
		if (!this.#app.device.isLayoutMobile()) {
			this.#app.nav.setContainerWidth(state.treeWidth);				
		}		
	}
	
	/**
	 * Loads a saved state from the cookie, and applies it to the tree.
	 */
	getTreeState() {
		var state = this.getLocal(this.getTreeStateCid());
	
		if (!state.treeWidth) {
			state.treeWidth = Config.defaultTreeWidth;
		}
		
		return state;
	}
	
	/**
	 * Saves the current tree state in a browser cookie.
	 */
	setTreeState(state) {
		this.setLocal(this.getTreeStateCid(), state);
	}
	
	/**
	 * Resets the focussing ID of the current tree state.
	 */
	resetTreeFocusId() {
		if (!this.#app.nav.behaviour) return;
		
		var state = this.getLocal(this.getTreeStateCid());
		
		this.#app.nav.behaviour.resetFocus(state);
		
		this.setLocal(this.getTreeStateCid(), state);
	}

	/////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////
	/////////////////////////////////////////////////////////////////////////
	
	/**
	 * Returns the local storage item for the given internal ID
	 */
	getLocal(cid, generic) {
		var stateEnc = localStorage.getItem(this.getCookieId(cid, generic));
		if (!stateEnc) return {};
		var state = JSON.parse(stateEnc);
		if (!state) return {};
		return state;
	}
	
	/**
	 * Returns the local storage item for the given internal ID
	 */
	getLocalEncrypted(cid, generic) {		
		var stateEnc = ls.get(this.getCookieId(cid, generic), { decrypt: true });
		if (!stateEnc) return {};
		
		var state = JSON.parse(stateEnc);
		if (!state) return {};
		
		return state;
	}
	
	/**
	 * Sets a local storage value. generic is used to tell if the setting is profile dependent or not.
	 */
	setLocal(cid, state, generic) {
		if (!state) {
			localStorage.setItem(this.getCookieId(cid, generic), "");
		} else {
			localStorage.setItem(this.getCookieId(cid, generic), JSON.stringify(state));
		}
	}
	
	/**
	 * Sets a local storage value. generic is used to tell if the setting is profile dependent or not.
	 */
	setLocalEncrypted(cid, state, generic) {
		if (!state) {
			ls.set(this.getCookieId(cid, generic), "", { encrypt: true });	
		} else {
			ls.set(this.getCookieId(cid, generic), JSON.stringify(state), { encrypt: true });
		}
	}
	
	/**
	 * Compose cookie ID. If generic is specified, the cookie is available for all profiles.
	 */
	getCookieId(cid, generic) {
		if (generic) {
			return 'notes_' + cid;
		} else {
			var uid = this.#app.db.determineLocalDbName();
			return uid + '_' + cid;
		}
	}
}