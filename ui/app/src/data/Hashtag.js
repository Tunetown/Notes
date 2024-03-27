/**
 * Handling of hashtag stuff.
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

class Hashtag {
	
	static startChar = '#';                                                                     ///< First character of the start tag

	static #stylePrefix = 'tag_';
	static #allowedChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_';   ///< Allowed characters
	static #startingPreChars = ' 	\n\r>&' + String.fromCharCode(160);                         ///< Characters allowed before the hashtag 
	static #terminationChars = ' 	\n\r<&' + String.fromCharCode(160);                         ///< Characters allowed after the hashtag
	 
	#app = null;


	constructor(app) {
		this.#app = app;
	}

	/**
	 * Extracts the tag name from a JQuery element's text content.
	 */
	extractTagFromElement(el) {
		var tag = el.text();
		if (tag.substring(0, Hashtag.startChar.length) != Hashtag.startChar) return false;
		if (!tag) return false;
		
		return tag.substring(Hashtag.startChar.length).trim();
	}
	
	/**
	 * Parses the passed string and returns an array of metadata about all 
	 * hashtags contained (may contain duplicates!).
	 *
	 * Hashtags must end with either a space, newline, carriage return or tab, or < and & signs to include HTML entities but exclude colors etc.,
	 * and start with nothing, a new line, carriagne return, > sign or space or tab. 
	 */
	parse(content) {
		var coll = [];
		var state = {};
		for(var i=0; i<content.length; ++i) {
			const token = this.parseChar(content[i], i, state, i == (content.length-1)/*, outsideTagsOnly*/);
			if (token) coll.push(token);
		}
		return coll;
	}
	
		/**
	 * Parsing function for one character. Expects the character, its position and a state object (empty object at the start).
	 * isAtEnd has to be true only when the last available character has been passed.
	 * outsideTagsOnly can be set to ignore all tags which are inside tag brackets (><). 
	 *
	 * Return a token descriptor if a token has been found.  
	 */
	parseChar(c, pos, state, isAtEnd) {
		function evalToken(endPos) {
			state.capturing = false;
			state.end = endPos;

			if (state.start < state.end) {
				if (
						(
							(!state.startingChar) 
							|| 
							(Hashtag.#startingPreChars.indexOf(state.startingChar) >= 0)
						) 
						&& 
						(
							isAtEnd
							||
							(Hashtag.#terminationChars.indexOf(c) >= 0)
						)
					)
				{
					state.last = c;
					return {
						start: state.start,
						end: state.end,
						orig: Hashtag.startChar + state.buffer,
						tag: Hashtag.trim(state.buffer),
					};
				}
			}
			return null;
		}
		
		if (state.capturing) {
			if (Hashtag.#allowedChars.indexOf(c) < 0) {
				var token = evalToken(pos);
				if (token) return token;
			}
			
			state.buffer += c;
			
			if (isAtEnd) {
				var token = evalToken(pos + 1);
				if (token) return token;
			}
		}

		if ((!state.capturing) && (c == Hashtag.startChar)) {
			state.capturing = true;
			state.start = pos + 1;
			state.buffer = '';
			
			state.startingChar = false;
			if (pos > 0) {
				state.startingChar = state.last;
			}
		}
		
		state.last = c;
		return null;
	}
	
	/**
	 * Reads from the state object if the algorithm is currently capturing a token.
	 */
	static isCapturing(state) {
		return state && state.capturing;
	}
	
	/**
	 * Returns the passed tag's color code. If no color is 
	 * set in the global metadata, a random color is returned and also saved.
	 */
	getColor(tag) {
		if (!tag) return Config.defaultHashtagColor;
		tag = tag.toLowerCase();
		
		var that = this;
		
		function randomColor() {
			const col = Hashtag.#getColorProposal(tag);
			
			that.#app.actions.hashtag.setColor(tag, col);
			
			return col;
		}
		
		const meta = this.#app.actions.meta.meta[HashtagActions.metaFileName];
		if (!meta) return randomColor();
		
		const hash = Tools.hashCode(tag);
		if(!meta.hasOwnProperty(hash)) return randomColor();
		
		const tagmeta = meta[hash];
		if (!tagmeta.color) return randomColor();
		
		return tagmeta.color;
	}
	
	/**
	 * Returns if the passed tag has a custom color.
	 */
	hasColor(tag) {
		if (!tag) return false;
		tag = tag.toLowerCase();
		
		const meta = this.#app.actions.meta.meta[HashtagActions.metaFileName];
		if (!meta) return false;
		
		const hash = Tools.hashCode(tag);
		if(!meta.hasOwnProperty(hash)) return false;
		
		const tagmeta = meta[hash];
		if (!tagmeta.color) return false;
		
		return true;
	}
	
	/**
	 * Returns a dynamic CSS class name for the given tag, to be used in lists.
	 */
	getListStyleClass(tag) {  // TODO move to view
		const col = this.getColor(tag);
		const styleStr = 'background-color: ' + col + ' !important; color: rgba(0,0,0,0) !important; margin-right: 4px;  border-radius: 10px; content: "__";';
		return this.#app.styles.getStyleClass(Hashtag.#stylePrefix + tag, ':before', styleStr);
	}
	
	/**
	 * Used by all pages etc. to show a tag's mentions.
	 */
	showTag(tag) {
		tag = Hashtag.trim(tag.toLowerCase());
		
		if (this.#app.device.isLayoutMobile()) {
			this.#app.routing.callSearch('tag:' + tag);
		} else {
			this.#app.nav.setSearchText('tag:' + tag);
		}
	}

	/**
	 * Trims a text to get a valid hashtag.
	 */
	static trim(tag) {
		var ret = "";
		for(var i in tag) {
			if (Hashtag.#allowedChars.indexOf(tag[i]) < 0) continue;
			ret += tag[i];
		}
		return ret;
	}
	
	//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	
	/**
	 * Tries to guess what the tag might need to look like.
	 */
	static #getColorProposal(tag) {
		for(var i in Config.tagNameColorProposals) {
			const p = Config.tagNameColorProposals[i];
			if (p && p.token && p.color && (tag.indexOf(p.token.toLowerCase()) >= 0)) return p.color;
		}
		
		return Tools.getRandomColor();
	}
}