import {oralHandler} from './oral-handler.mjs';
Deno.serve(oralHandler(name=>Deno.env.get(name)));
