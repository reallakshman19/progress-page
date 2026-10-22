// Replies go to the coordinator as a prefilled GitHub issue form: the Owner submits it, so GitHub signs and time-stamps the input.
// A reply made from a local file or a preview points back at the published page.
export function issueUrl(rt, fields) {
  if (!rt || rt.kind !== 'github-issue') return null;
  const p = new URLSearchParams(Object.assign({ template: rt.template, labels: 'owner-input', target: rt.target }, fields));
  return 'https://github.com/' + rt.repo + '/issues/new?' + p.toString();
}

export const pageUrl = (rt) => (location.protocol === 'https:' ? location.href.split('#')[0] : (rt && rt.site) || '');
