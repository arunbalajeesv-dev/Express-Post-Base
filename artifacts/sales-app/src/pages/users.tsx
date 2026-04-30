import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListUsers,
  useCreateUser,
  getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Users as UsersIcon,
  Shield,
  Smartphone,
  Loader2,
  MoreVertical,
  KeyRound,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";

function apiHeaders() {
  const token = localStorage.getItem("auth_token");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

const userSchema = z.object({
  name: z.string().min(1, "Name is required"),
  userId: z.string().min(1, "User ID is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["Manager", "Sales"]),
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian mobile number")
    .optional()
    .or(z.literal("")),
});

type UserFormValues = z.infer<typeof userSchema>;

const passwordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirm: z.string().min(6, "Please confirm the password"),
}).refine((d) => d.password === d.confirm, {
  message: "Passwords do not match",
  path: ["confirm"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

function useUpdatePassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, password }: { id: number; password: string }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: apiHeaders(),
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || "Failed to update password");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: getListUsersQueryKey() }),
  });
}

function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
        headers: apiHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || "Failed to remove user");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: getListUsersQueryKey() }),
  });
}

function ChangePasswordDialog({
  user,
  open,
  onClose,
}: {
  user: { id: number; name: string };
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const updatePassword = useUpdatePassword();

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  function handleClose() {
    form.reset();
    onClose();
  }

  const onSubmit = async (data: PasswordFormValues) => {
    try {
      await updatePassword.mutateAsync({ id: user.id, password: data.password });
      toast({ title: "Password updated", description: `Password changed for ${user.name}` });
      handleClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Change Password
          </DialogTitle>
          <p className="text-sm text-muted-foreground">Set a new password for {user.name}</p>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-1">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-2">
              <Button variant="ghost" type="button" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={updatePassword.isPending}>
                {updatePassword.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Update Password
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserDialog({
  user,
  open,
  onClose,
}: {
  user: { id: number; name: string };
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const deleteUser = useDeleteUser();

  const handleDelete = async () => {
    try {
      await deleteUser.mutateAsync(user.id);
      toast({ title: "User removed", description: `${user.name} has been removed from the team.` });
      onClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Remove User
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground py-2">
          Are you sure you want to remove <span className="font-semibold text-foreground">{user.name}</span>? This action cannot be undone.
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={deleteUser.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteUser.isPending}
          >
            {deleteUser.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Users() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState<{ open: boolean; user: { id: number; name: string } }>({
    open: false,
    user: { id: 0, name: "" },
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: { id: number; name: string } }>({
    open: false,
    user: { id: 0, name: "" },
  });

  const { data: usersData, isLoading } = useListUsers({
    query: { queryKey: getListUsersQueryKey() },
  });

  const createUser = useCreateUser();

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: "", userId: "", password: "", role: "Sales", mobile: "" },
  });

  const onSubmit = (data: UserFormValues) => {
    createUser.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "User created successfully" });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        setIsOpen(false);
        form.reset();
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Error", description: err.message || "Failed to create user" });
      },
    });
  };

  const users = (usersData?.data ?? []).filter((u: any) => u.userId);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Members</h1>
          <p className="text-muted-foreground">Manage your field sales team</p>
        </div>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>User ID</FormLabel>
                      <FormControl><Input placeholder="johndoe123" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mobile (Optional)</FormLabel>
                      <FormControl><Input placeholder="9876543210" type="tel" maxLength={10} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Sales">Sales</SelectItem>
                            <SelectItem value="Manager">Manager</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="pt-4">
                  <Button type="submit" className="w-full" disabled={createUser.isPending}>
                    {createUser.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Create User
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      ) : users.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {users.map((u: any) => (
            <Card
              key={u.id}
              className={`overflow-hidden transition-all border-border/50 ${u.role === "Sales" ? "cursor-pointer hover:shadow-md hover:border-primary/40" : ""}`}
              onClick={() => u.role === "Sales" && navigate(`/agents/${u.id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <h3 className={`font-semibold text-lg truncate ${u.role === "Sales" ? "text-primary hover:underline" : ""}`}>
                        {u.name}
                      </h3>
                      {/* Actions menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem
                            onClick={() => setPasswordDialog({ open: true, user: { id: u.id, name: u.name } })}
                            className="gap-2"
                          >
                            <KeyRound className="h-4 w-4" />
                            Change Password
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteDialog({ open: true, user: { id: u.id, name: u.name } })}
                            className="gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="text-xs text-muted-foreground mt-0.5">{u.userId}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                      <Shield className="h-3.5 w-3.5" />
                      {u.role}
                    </div>
                    {u.mobile && (
                      <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                        <Smartphone className="h-3.5 w-3.5" />
                        {u.mobile}
                      </div>
                    )}
                    {u.role === "Sales" && (
                      <div className="text-xs text-primary/70 mt-2">Click to view performance →</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border rounded-xl border-dashed">
          <UsersIcon className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <h3 className="text-lg font-medium">No users found</h3>
          <p className="text-muted-foreground text-sm">Create your first team member.</p>
        </div>
      )}

      <ChangePasswordDialog
        user={passwordDialog.user}
        open={passwordDialog.open}
        onClose={() => setPasswordDialog((s) => ({ ...s, open: false }))}
      />
      <DeleteUserDialog
        user={deleteDialog.user}
        open={deleteDialog.open}
        onClose={() => setDeleteDialog((s) => ({ ...s, open: false }))}
      />
    </div>
  );
}
