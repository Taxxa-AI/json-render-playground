/**
 * A canned JSONL patch stream — byte for byte the shape a model emits.
 *
 * Read it top to bottom and you can see the design: `root` first, then
 * elements in rough paint order, then `/state` patches one array item at a
 * time, then a late `replace` correcting a value it had already sent.
 *
 * Two things are worth noticing before you play it:
 *
 *   - `/elements/detail` arrives with children: ["list"] BEFORE `list` exists.
 *     That branch renders empty for one frame and then completes itself. In a
 *     nested-tree format this would be impossible; in a flat map it is free.
 *
 *   - The last line is a `replace` on a path the model already wrote. Models
 *     do this — they revise. Your renderer has to tolerate it.
 */
export const STREAM_SCRIPT: string[] = [
  `{"op":"add","path":"/root","value":"screen"}`,
  `{"op":"add","path":"/elements/screen","value":{"type":"Screen","props":{"title":"Revenue overview","subtitle":"FY2026 · Q3"},"children":["kpis","detail"]}}`,
  `{"op":"add","path":"/elements/kpis","value":{"type":"Stack","props":{"direction":"row","gap":"md","align":"stretch","wrap":true},"children":["m1","m2","m3"]}}`,
  `{"op":"add","path":"/elements/m1","value":{"type":"Metric","props":{"label":"Revenue","value":"€48,200","delta":"+12% vs Q2","tone":"success"},"children":[]}}`,
  `{"op":"add","path":"/elements/m2","value":{"type":"Metric","props":{"label":"Outstanding","value":"€9,640","delta":"3 invoices","tone":"warning"},"children":[]}}`,
  `{"op":"add","path":"/elements/m3","value":{"type":"Metric","props":{"label":"Margin","value":"31.4%","delta":"-1.2pt","tone":"danger"},"children":[]}}`,
  `{"op":"add","path":"/elements/detail","value":{"type":"Card","props":{"title":"Open invoices","subtitle":null},"children":["list"]}}`,
  `{"op":"add","path":"/elements/list","value":{"type":"Stack","props":{"direction":"column","gap":"sm","align":null,"wrap":null},"repeat":{"statePath":"/invoices","key":"id"},"children":["row"]}}`,
  `{"op":"add","path":"/elements/row","value":{"type":"Stack","props":{"direction":"row","gap":"md","align":"center","wrap":null},"children":["c","a","s"]}}`,
  `{"op":"add","path":"/elements/c","value":{"type":"Text","props":{"value":{"$item":"client"},"tone":null,"size":null},"children":[]}}`,
  `{"op":"add","path":"/elements/a","value":{"type":"Text","props":{"value":{"$item":"amount"},"tone":null,"size":null},"children":[]}}`,
  `{"op":"add","path":"/elements/s","value":{"type":"Badge","props":{"label":{"$item":"status"},"tone":"warning"},"children":[]}}`,
  `{"op":"add","path":"/state/invoices","value":[]}`,
  `{"op":"add","path":"/state/invoices/0","value":{"id":"1","client":"Acme Oy","amount":"€3,480","status":"30 days"}}`,
  `{"op":"add","path":"/state/invoices/1","value":{"id":"2","client":"Borealis AB","amount":"€4,900","status":"60 days"}}`,
  `{"op":"add","path":"/state/invoices/2","value":{"id":"3","client":"Cygnus AS","amount":"€1,260","status":"overdue"}}`,
  `{"op":"replace","path":"/elements/m3/props/tone","value":"warning"}`,
];
