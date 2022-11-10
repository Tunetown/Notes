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
	static allowedChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_';    ///< Allowed characters
	static startingPreChars = ' 	\n\r>&' + String.fromCharCode(160);                         ///< Characters allowed before the hashtag 
	static terminationChars = ' 	\n\r<&' + String.fromCharCode(160);                         ///< Characters allowed after the hashtag
	 

	/**
	 * Parses the passed string and returns an array of metadata about all 
	 * hashtags contained (may contain duplicates!).
	 *
	 * Hashtags must end with either a space, newline, carriage return or tab, or < and & signs to include HTML entities but exclude colors etc.,
	 * and start with nothing, a new line, carriagne return, > sign or space or tab. 
	 */
	static parse(content/*, outsideTagsOnly*/) {
		var coll = [];
		var state = {};
		for(var i=0; i<content.length; ++i) {
			const token = Hashtag.parseChar(content[i], i, state, i == (content.length-1)/*, outsideTagsOnly*/);
			if (token) coll.push(token);
		}
		return coll;
	}
	
	/**
	 * Trims a text to get a valid hashtag.
	 */
	static trim(tag) {
		var ret = "";
		for(var i in tag) {
			if (Hashtag.allowedChars.indexOf(tag[i]) < 0) continue;
			ret += tag[i];
		}
		return ret;
	}
	
	/**
	 * Parsing function for one character. Expects the character, its position and a state object (empty object at the start).
	 * isAtEnd has to be true only when the last available character has been passed.
	 * outsideTagsOnly can be set to ignore all tags which are inside tag brackets (><). 
	 *
	 * Return a token descriptor if a token has been found.  
	 */
	static parseChar(c, pos, state, isAtEnd/*, outsideTagsOnly*/) {
		function evalToken(endPos) {
			state.capturing = false;
			state.end = endPos;

			if (state.start < state.end) {
				/*var tmp1 = (!state.startingChar) 
				var tmp2 = Hashtag.startingPreChars.indexOf(state.startingChar)
				var tmp3 = Hashtag.terminationChars.indexOf(c)
				var tmp4 = c.charCodeAt(0);*/
				if (
						(
							(!state.startingChar) 
							|| 
							(Hashtag.startingPreChars.indexOf(state.startingChar) >= 0)
						) 
						&& 
						(
							isAtEnd
							||
							(Hashtag.terminationChars.indexOf(c) >= 0)
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
			if (Hashtag.allowedChars.indexOf(c) < 0) {
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
	
	static metaFileName = 'tagMeta';
	
	/**
	 * Tries to guess what the tag might need to look like.
	 */
	static getColorProposal(tag) {
		const tagL = tag.toLowerCase();
		
		for(var i in Config.tagNameColorProposals) {
			const p = Config.tagNameColorProposals[i];
			if (p && p.token && p.color && (tagL.indexOf(p.token.toLowerCase()) >= 0)) return p.color;
		}
		
		return Tools.getRandomColor();
	}
	
	/**
	 * Returns the passed tag's color code. If no color is 
	 * set in the global metadata, a random color is returned and also saved.
	 */
	static getColor(tag) {
		if (!tag) return Config.defaultHashtagColor;
		
		function randomColor() {
			const col = Hashtag.getColorProposal(tag);
			
			Hashtag.setColor(tag, col);
			
			return col;
		}
		
		const meta = MetaActions.getInstance().meta[Hashtag.metaFileName];
		if (!meta) return randomColor();
		
		const hash = Tools.hashCode(tag);
		if(!meta.hasOwnProperty(hash)) return randomColor();
		
		const tagmeta = meta[hash];
		if (!tagmeta.color) return randomColor();
		
		return tagmeta.color;
	}
	
	/**
	 * Sets the tags color in global metadata. Returns a promise.
	 */
	static setColor(tag, color) {
		if (!tag) return Promise.resolve();
		
		const m = MetaActions.getInstance();
		var meta = m.meta[Hashtag.metaFileName];
		if (!meta) meta = {};
		
		const hash = Tools.hashCode(tag);
		if(!meta.hasOwnProperty(hash)) {
			meta[hash] = {
				tag: tag
			};
		}
		
		meta[hash].color = color;
		
		m.meta[Hashtag.metaFileName] = meta;
		
		return m.saveGlobalMeta();
	}
	
	static stylePrefix = 'tag_';
	
	/**
	 * Returns a dynamic CSS class name for the given tag, to be used in lists.
	 */
	static getListStyleClass(tag) {
		const col = Hashtag.getColor(tag);
		const styleStr = 'background-color: ' + col + ' !important; color: rgba(0,0,0,0) !important; margin-right: 4px;  border-radius: 10px; content: "__";';
		return Styles.getInstance().getStyleClass(Hashtag.stylePrefix + tag, ':before', styleStr);
	}
}