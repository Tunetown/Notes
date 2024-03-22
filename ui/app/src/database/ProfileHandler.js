/**
 * Database remote connection profile management.
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
class ProfileHandler {
	
	#current = false;
	
	/**
	 * Options have to be:
	 * {
	 *     saveProfilesCallback: function(arr) => void: Must store the passed array of profile objects somehow, and replace the old ones if there were any.
	 *     getProfilesCallback: function() => array: Must deliver the stored array of profile objects
	 * }
	 */
	constructor(dbHandler, options) {
		this.dbHandler = dbHandler;
		this.options = options;
	}
	
	/**
	 * Exports the profile as base64
	 */
	exportProfile(url) {
		if (!url) url = this.getCurrentProfile().url;
		if (!url || url == "local") return 'local';	
		
		var prof = this.getProfile(url);
		if (!prof) {
			console.log("Profile " + url + " not found");
			return false;
		}
		
		return this.encodeProfile({
			url: prof.url,
		});
	}
	
	/**
	 * Imports the passed encoded profile. If it already exists, it will be overwritten.
	 * Returns if the profile has been changed.
	 */
	importProfile(content) {
		if (content == 'local') {
			if (this.#current != 'local') {
				this.#current = 'local';
				return true;
			} else {
				return false;
			}
		}
		
		// Filter out any URLs before the data
		if (content && (content.length > 0)) {
			var splt = content.split('/');
			if (splt && splt.length > 0) {
				for(var i = splt.length - 1; i>=0; --i) {
					if (!splt[i] || (splt[i].length < 5)) continue;
					content = splt[i];	
					break;
				}
			}
		} else throw new Error('No profile passed');

		var str = Tools.b64DecodeUnicode(content);
		if (!str) throw new Error('No content received');
		
		var obj = JSON.parse(str);
		
		if (!obj.url) {
			throw new Error("No URL contained in profile");
		}

		if (obj.url == this.#current) {
			return false;
		} else {
			this.selectOrCreateProfile(obj.url);
			return true;
		}
	}
	
	/**
	 * Encodes the passed profile object
	 */
	encodeProfile(obj) {
		return Tools.b64EncodeUnicode(JSON.stringify(obj));
	}
	
	/**
	 * Returns the current profile's data. If no profile is selected this selects the local profile.
	 */
	getCurrentProfile() {
		var curr = this.getProfile(this.#current);
		if (curr) return curr;

		// The current profile does not exist or is not allowed: Select the local or default one.
		this.#current = this.getDefaultProfile();
		
		curr = this.getProfile(this.#current);
		if (curr) return curr;
		
		console.log("Error: Could not load profile: " + this.#current);
		return null;
	}
	
	/**
	 * If existent, returns the profile with URL. If not, returns false.
	 */
	getProfile(url) {
		var profiles = this.options.getProfilesCallback();
		
		var prof = null;
		for(var i in profiles) {
			if (profiles[i].url == url) {
				return profiles[i];
			}
		}
		
		return null;
	}
	
	/**
	 * Returns all profiles in an array.
	 */
	getProfiles() {
		return this.options.getProfilesCallback();
	}
	
	/**
	 * Deletes the profile (if not local) and returns to the local one.
	 */
	deleteProfile(url) {
		if (!url) url = this.getCurrentProfile().url;
		if (url == "local") return;
		
		console.log("Deleting profile: " + url);

		var profiles = this.options.getProfilesCallback();
		var newProfiles = [];
		for(var p in profiles) {
			if (profiles[p].url != url) {
				newProfiles.push(profiles[p]);
			}
		}
		
		this.options.saveProfilesCallback(newProfiles);

		// Select default profile
		this.#current = this.getDefaultProfile();
	}
	
	/**
	 * Searches for a default profile in the existing profiles. If no default
	 * profile can be found, "local" is returned, if found, the URL is returned.
	 */
	getDefaultProfile() {
		return "local";
	}
	
	/**
	 * Returns if the current profile can use clone mode.
	 */
	profileCanClone() {
		if (this.getCurrentProfile().url == "local") return false;
		return true;
	}
	
	/**
	 * Returns if the current profile can use autosync.
	 */
	profileCanAutoSync() {
		if (!this.getCurrentProfile().clone) return false;
		return true;
	}
	
	/**
	 * Sets a profile by its URL. If no profile has been found, a new one is being created.
	 * Returns if the profile has been created newly.
	 */
	selectOrCreateProfile(url) {
		url = this.dbHandler.prepareNewRemoteUrl(url);
		
		var prof = this.getProfile(url);
		if (prof) {
			this.#current = prof.url;
			
			console.log("Selected profile: " + this.#current);
			return false;
			
		} else {
			// No profile found. We then create a new one, using the passed URL, and select it.
			this.saveProfile({
				url: url,
				clone: false,
				autoSync: false	
			});
			
			this.#current = url;
			return true;			
		}
	}
	
	/**
	 * Saves the passed profile. If not existent, it will be created.
	 */
	saveProfile(data) {
		if (data.url == "local") return;
		data.url = this.dbHandler.prepareNewRemoteUrl(data.url);

		if (!data.clone) {
			data.autoSync = false;
		}
		
		var prof = this.getProfile(data.url);
		if (prof) {
			// Existing profile
			console.log("Updating existing profile for " + data.url);
			
			var profiles = this.options.getProfilesCallback();
			for(var i in profiles) {
				if (profiles[i].url == data.url) {
					profiles[i] = data;
					break;
				}
			}
			this.options.saveProfilesCallback(profiles);
		} else {
			// New profile
			console.log("Creating new profile for " + data.url);
			
			var profiles = this.options.getProfilesCallback();
			profiles.push(data);
			this.options.saveProfilesCallback(profiles);
		}
	}
	
	/**
	 * Returns the database name from an url.
	 */
	static extractDatabaseName(url) {         // #IGNORE static
		if (url == 'local') return 'local';
		
		return url.split('/').slice(-1).join();
	}
	

}