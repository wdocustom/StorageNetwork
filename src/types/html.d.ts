// private/*.html files are imported as strings (webpack asset/source rule in
// next.config.mjs).
declare module "*.html" {
  const content: string;
  export default content;
}
