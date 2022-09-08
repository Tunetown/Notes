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

	constructor() {
		/**
		 * Internal IDs for different cookies
		 */
		this.cidTreeState = 'ts';
		this.cidProfiles = "pr";	
		this.cidConsoleSettings = "cs";	
		this.cidViewSettings = "vs";	
		this.cidViewState = "vt";
		this.cidBoardState = "bt";
		this.cidMobileOverride = "mo";
		this.cidLastOpenedUrl = "lo";
	}
	
	/**
	 * Singleton factory
	 */
	static getInstance() {
		if (!ClientState.instance) ClientState.instance = new ClientState();
		return ClientState.instance;
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
	 * Returns the URL of the last loaded page, or false if disabled.
	 */
	getLastOpenedUrl() {
		var ret = this.getLocal(this.cidLastOpenedUrl, true);
		return ret.enabled ? ret.url : false;
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
		
		if (!ret.navMode) ret.navMode = 'detail';
		if (!ret.tileMaxSize) ret.tileMaxSize = 220;
		
		return ret;
	}
	
	/**
	 * Saves the passed view settings
	 */
	saveViewSettings(p) {
		this.setLocal(this.cidViewSettings, p);
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
		var n = Notes.getInstance();
		var t = NoteTree.getInstance();
		
		var state = this.getLocal(this.getTreeStateCid());
		state.treeWidth = n.isMobile() ? state.treeWidth : ((t.getContainerWidth() > 100) ? t.getContainerWidth() : state.treeWidth);
		
		t.behaviour.saveState(state);
		
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
		var n = Notes.getInstance();
		var t = NoteTree.getInstance();
		
		var state = this.getLocal(this.getTreeStateCid());
	
		// Behaviour specific fields
		t.behaviour.restoreState(state);

		// Tree width
		if (!n.isMobile()) {
			if (state.treeWidth) {
				t.setContainerWidth(state.treeWidth);				
			} else {
				t.setContainerWidth(350);				
			}
		}		
	}
	
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
	 * Compose cookie ID. If generic is specified, the cookie is available for all profiles.
	 */
	getCookieId(cid, generic) {
		if (generic) {
			return 'notes_' + cid;
		} else {
			var uid = Database.getInstance().determineLocalDbName();
			return uid + '_' + cid;
		}
	}
}