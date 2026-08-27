import type { WorkspaceMember } from "@/lib/workspace/repository";
import { getMemberInitials } from "@/lib/workspace/member-initials";
import styles from "./member-badges.module.css";

type MemberBadgesProps = {
  members: WorkspaceMember[];
};

export function MemberBadges({ members }: MemberBadgesProps) {
  if (members.length === 0) return null;

  return (
    <ul className={styles.list} aria-label="Membros do workspace">
      {members.map((member) => (
        <li key={member.userId}>
          <span
            className={styles.badge}
            data-color={member.accentColor}
            title={member.displayName ?? "Membro sem nome"}
            aria-label={member.displayName ?? "Membro sem nome"}
          >
            {getMemberInitials(member.displayName)}
          </span>
        </li>
      ))}
    </ul>
  );
}
