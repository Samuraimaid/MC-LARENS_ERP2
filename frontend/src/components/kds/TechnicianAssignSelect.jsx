import React from "react";
import PropTypes from "prop-types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getTechnicianAvailability } from "@/lib/technicianAvailability";
import { cn } from "@/lib/utils";

function sortTeam(team = []) {
  return [...team].sort((a, b) => {
    const aAvail = getTechnicianAvailability(a);
    const bAvail = getTechnicianAvailability(b);
    const levelRank = { green: 0, yellow: 1, red: 2 };
    const levelDiff =
      (levelRank[aAvail.level] ?? 9) - (levelRank[bAvail.level] ?? 9);
    if (levelDiff !== 0) return levelDiff;
    return (a.active_jobs || 0) - (b.active_jobs || 0)
      || String(a.name || "").localeCompare(String(b.name || ""), "es");
  });
}

export function TechnicianAssignSelect({
  team = [],
  value = "",
  onValueChange,
  disabled = false,
  placeholder = "Seleccionar técnico",
  className,
}) {
  return (
    <Select value={value || ""} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {sortTeam(team).map((member) => {
          const avail = getTechnicianAvailability(member);
          return (
            <SelectItem
              key={member.user_id}
              value={member.user_id}
              disabled={!avail.assignable}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className={cn("h-2 w-2 rounded-full shrink-0", avail.dot)} />
                <span className="truncate">
                  {member.name}
                  {" · "}
                  {avail.label}
                  {avail.jobs > 0 ? ` (${avail.jobs})` : ""}
                </span>
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

TechnicianAssignSelect.propTypes = {
  team: PropTypes.array,
  value: PropTypes.string,
  onValueChange: PropTypes.func,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string,
  className: PropTypes.string,
};