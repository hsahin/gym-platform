"use client";

import { useState } from "react";
import { Chip } from "@heroui/react";
import { ListView } from "@heroui-pro/react/list-view";
import { Segment } from "@heroui-pro/react/segment";
import { LazyPlatformWorkbench } from "@/components/dashboard/LazyPlatformWorkbench";
import {
  EmptyPanel,
  PageSection,
  formatDate,
  statusChip,
  type DashboardPageProps,
} from "@/components/dashboard/shared";

export function MembersDashboardPage({ snapshot }: DashboardPageProps) {
  const [membersView, setMembersView] = useState<"members" | "waivers">("members");

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
      <PageSection title="Members" description="Review member state and waiver completion.">
        <div className="grid content-start gap-3">
          <Segment
            className="w-full max-w-[22rem]"
            selectedKey={membersView}
            size="sm"
            onSelectionChange={(key) => setMembersView(String(key) as typeof membersView)}
          >
            <Segment.Item id="members">Members</Segment.Item>
            <Segment.Item id="waivers">Waivers</Segment.Item>
          </Segment>

          {membersView === "members" ? (
            snapshot.members.length > 0 ? (
              <ListView aria-label="Members" items={snapshot.members}>
                {(member) => {
                  const chip = statusChip(member.status);

                  return (
                    <ListView.Item id={member.id} textValue={member.fullName}>
                      <ListView.ItemContent>
                        <ListView.Title>{member.fullName}</ListView.Title>
                        <ListView.Description>
                          {member.email} · {formatDate(member.joinedAt)}
                        </ListView.Description>
                      </ListView.ItemContent>
                      <div className="flex flex-wrap gap-2">
                        <Chip color={chip.color} size="sm" variant={chip.variant}>
                          {member.status}
                        </Chip>
                        <Chip size="sm" variant="tertiary">
                          {member.waiverStatus}
                        </Chip>
                        {snapshot.memberPortalAccessMemberIds.includes(member.id) ? (
                          <Chip size="sm" variant="soft">
                            portal
                          </Chip>
                        ) : null}
                      </div>
                    </ListView.Item>
                  );
                }}
              </ListView>
            ) : (
              <EmptyPanel
                title="No members yet"
                description="Add the first member or import your existing member list."
              />
            )
          ) : snapshot.waivers.length > 0 ? (
            <ListView aria-label="Waivers" items={snapshot.waivers}>
              {(waiver) => {
                const chip = statusChip(waiver.status);

                return (
                  <ListView.Item id={waiver.memberId} textValue={waiver.memberName}>
                    <ListView.ItemContent>
                      <ListView.Title>{waiver.memberName}</ListView.Title>
                      <ListView.Description>
                        {waiver.fileName ?? "Nog geen document"} ·{" "}
                        {waiver.expiresAt ? formatDate(waiver.expiresAt) : "Geen verloopdatum"}
                      </ListView.Description>
                    </ListView.ItemContent>
                    <Chip color={chip.color} size="sm" variant={chip.variant}>
                      {waiver.status}
                    </Chip>
                  </ListView.Item>
                );
              }}
            </ListView>
          ) : (
            <EmptyPanel
              title="No waivers tracked"
              description="Signed or requested waivers appear here once members are added."
            />
          )}
        </div>
      </PageSection>

      <LazyPlatformWorkbench sections={["members"]} showLaunchHeader={false} snapshot={snapshot} />
    </div>
  );
}
