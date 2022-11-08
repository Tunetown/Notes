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
	
	/**
	 * Parses the passed string and returns an array of metadata about all 
	 * hashtags contained (may contain duplicates!).
	 *
	 * If ignoreSurroundedBy is given, all occurrences which are surrounded by this character will be ignored.
	 */
	static parse(content, ignoreStartedBy, ignoreEndedBy) {
		var capturing = false;
		var start = -1;
		var end = -1;
		var coll = [];
		var hadQuote = false;
		for(var i=0; i<content.length; ++i) {
			const c = content[i];
			
			if (capturing && (Hashtag.allowedChars.indexOf(c) < 0)) {
				capturing = false;
				end = i;

				if (ignoreStartedBy && ignoreEndedBy) {
					if (hadQuote && (c == ignoreEndedBy)) {
						continue;
					}
				}
				
				if (start != end) {
					coll.push({
						start: start,
						end: end,
						tag: content.substring(start, end)
					});
				}
			}

			if ((!capturing) && (c == Hashtag.startChar)) {
				capturing = true;
				start = i+1;
				
				if (ignoreStartedBy && ignoreEndedBy) {
					if ((i > 0) && (content[i-1] == ignoreStartedBy)) {
						hadQuote = true;
					} else {
						hadQuote = false;
					}
				}
			}
		}
		return coll;
	}
}