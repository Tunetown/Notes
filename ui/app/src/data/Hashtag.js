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
					/*if (outsideTagsOnly) {
						if (
								(state.startingChar != '>')
								&&
								(c != '<')
							)
						{
							state.last = c;
							return {
								start: state.start,
								end: state.end,
								tag: state.buffer.trim(),
							};
						}
					} else {*/
						state.last = c;
						return {
							start: state.start,
							end: state.end,
							orig: Hashtag.startChar + state.buffer,
							tag: Hashtag.trim(state.buffer),
						};
					//}
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
}