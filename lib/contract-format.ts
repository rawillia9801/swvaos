export const CONTRACT_SECTION_PREFIX = "[[SECTION]] ";
export const CONTRACT_NOTICE_PREFIX = "[[NOTICE]] ";

export type ContractTerm = {
  kind: "clause" | "section" | "notice";
  text: string;
};

export const contractSection = (title: string) => `${CONTRACT_SECTION_PREFIX}${title}`;
export const contractNotice = (text: string) => `${CONTRACT_NOTICE_PREFIX}${text}`;

export function parseContractTerm(term: string): ContractTerm {
  if (term.startsWith(CONTRACT_SECTION_PREFIX)) return { kind: "section", text: term.slice(CONTRACT_SECTION_PREFIX.length).trim() };
  if (term.startsWith(CONTRACT_NOTICE_PREFIX)) return { kind: "notice", text: term.slice(CONTRACT_NOTICE_PREFIX.length).trim() };
  return { kind: "clause", text: term.trim() };
}
