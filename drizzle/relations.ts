import { relations } from "drizzle-orm";
import { users, managers, branches, managerBranches, visits, locationLogs } from "./schema";

export const usersRelations = relations(users, ({ one }) => ({
  manager: one(managers, {
    fields: [users.id],
    references: [managers.userId],
  }),
}));

export const managersRelations = relations(managers, ({ one, many }) => ({
  user: one(users, {
    fields: [managers.userId],
    references: [users.id],
  }),
  branches: many(managerBranches),
  visits: many(visits),
  locationLogs: many(locationLogs),
}));

export const branchesRelations = relations(branches, ({ many }) => ({
  managers: many(managerBranches),
  visits: many(visits),
}));

export const managerBranchesRelations = relations(managerBranches, ({ one }) => ({
  manager: one(managers, {
    fields: [managerBranches.managerId],
    references: [managers.id],
  }),
  branch: one(branches, {
    fields: [managerBranches.branchId],
    references: [branches.id],
  }),
}));

export const visitsRelations = relations(visits, ({ one }) => ({
  manager: one(managers, {
    fields: [visits.managerId],
    references: [managers.id],
  }),
  branch: one(branches, {
    fields: [visits.branchId],
    references: [branches.id],
  }),
}));

export const locationLogsRelations = relations(locationLogs, ({ one }) => ({
  manager: one(managers, {
    fields: [locationLogs.managerId],
    references: [managers.id],
  }),
}));
