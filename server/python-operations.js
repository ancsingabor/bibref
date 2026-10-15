import { ApiError } from './store.js';

export function pythonOperation(operation, args, modules) {
  const invalid = () => { throw new ApiError('invalid_operation'); };
  if (typeof operation !== 'string' || !Array.isArray(args)) invalid();
  const arity = n => { if (args.length !== n) invalid(); };
  const integer = (value, min, max) => { if (!Number.isSafeInteger(value) || value < min || value > max) invalid(); return value; };
  const text = (value, max = 60000) => {
    if (typeof value !== 'string' || !value.length || /[\x00-\x1f\x7f#]/u.test(value) || Buffer.byteLength(value) > max) invalid();
    return value;
  };
  const module = value => { if (!modules.includes(value)) invalid(); return value; };
  const clipboard = value => integer(value, 1, 2);
  let command, parse = () => null;
  const match = (output, expression) => {
    const found = output.match(expression);
    if (!found) throw new ApiError('engine_protocol', 422);
    return found;
  };
  switch (operation) {
    case 'text_n': case 'lookup_n': case 'latintext_n':
      arity(2); command = `${operation.replace('_n', '')}${clipboard(args[0])} ${text(args[1])}`;
      if (operation === 'lookup_n') module(args[1].split(/ +/)[0]);
      if (operation !== 'latintext_n') parse = output => match(output, /Stored internally as (\w+)\./u)[1];
      break;
    case 'raw_n':
      arity(5);
      if (!/^[A-Za-z0-9_]+$/.test(text(args[2], 128))) invalid();
      command = `raw${clipboard(args[0])} ${module(args[1])} ${args[2]} ${integer(args[3], 1, 2147483647)} ${integer(args[4], -1, 2147483647)}`;
      break;
    case 'find_n':
      arity(2); command = `find${clipboard(args[0])} ${module(args[1])}`;
      parse = output => {
        match(output, /\d+ occurrences\./);
        return [...output.matchAll(/Found in (.*?) \(book position (\d+)-(\d+)\)/gu)]
          .map(m => [m[1], Number(m[2]), Number(m[3])]);
      };
      break;
    case 'maxresults':
      arity(1); command = `maxresults ${integer(args[0], 0, 10000)}`;
      parse = output => Number(match(output, /Set to (\d+)\./)[1]);
      break;
    case 'jaccard12':
      arity(0); command = operation;
      parse = output => Number(match(output, /Jaccard distance is ([0-9]+\.[0-9]+)\./)[1]) * 100;
      break;
    case 'nearest12':
      arity(0); command = operation;
      parse = output => { const m = match(output, /Nearest Jaccard distance is ([0-9]+\.[0-9]+) with substring (\w+)\./); return [Number(m[1]) * 100, m[2]]; };
      break;
    case 'getrefs_maxlength':
      arity(1); command = `getrefs ${text(args[0], 1024)}`;
      module(args[0].split(/ +/)[0]); module(args[0].split(/ +/)[1]);
      parse = output => { match(output, /Finished/); return [...output.matchAll(/length=(\d+),/g)].at(-1)?.[1] ?? (() => { throw new ApiError('engine_protocol', 422); })(); };
      break;
    default: invalid();
  }
  if (Buffer.byteLength(command) > 65536) invalid();
  return { command, parse };
}
