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
 * Name of the root node if it needs to be shown to the user. Leave this 
 * empty for normal usage.
 */
Config.ROOT_NAME = '';

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
