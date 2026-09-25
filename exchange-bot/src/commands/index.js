import * as kalkulator from './kalkulator.js';
import * as kurs from './kurs.js';
import * as ogloszenie from './ogloszenie.js';
import * as panel from './panel.js';
import * as setup from './setup.js';
import * as statystyki from './statystyki.js';
import * as ticket from './ticket.js';

export const commands = new Map([setup, panel, kurs, kalkulator, ticket, statystyki, ogloszenie].map((c) => [c.data.name, c]));
export { ogloszenie };
