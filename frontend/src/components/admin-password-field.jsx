import { useState } from "react";
import { Eye, EyeOff, Lock, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export function AdminPasswordField({ userId, username, onPasswordChanged }) {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChangePassword = async () => {
    setError("");

    if (!newPassword || !confirmPassword) {
      setError("Both password fields are required");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/admin/change-user-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userId: parseInt(userId),
          newPassword,
        }),
      });

      const text = await res.text();
      let data;

      try {
        data = JSON.parse(text);
      } catch {
        console.error("Response was not JSON:", text);
        setError(`Server error: ${text || "No response"}`);
        setLoading(false);
        return;
      }

      if (res.ok) {
        toast({ title: "Success!", description: "Password has been changed" });
        setNewPassword("");
        setConfirmPassword("");
        setShowNewPassword(false);
        setShowConfirmPassword(false);
        setError("");
        setEditOpen(false);
        onPasswordChanged?.();
      } else {
        setError(data.error || "Failed to change password");
      }
    } catch (err) {
      console.error("Password change error:", err);
      setError(err.message || "Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Lock className="w-4 h-4" />
        Password (Masked for Security)
      </Label>
      <p className="text-xs text-muted-foreground">Passwords are hashed and cannot be displayed. You can only reset them.</p>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type={showPassword ? "text" : "password"}
            value="••••••••"
            readOnly
            className="pr-10 bg-muted/50 cursor-default"
          />
          <button
            type="button"
            tabIndex="0"
            onMouseDown={(e) => {
              e.preventDefault();
              setShowPassword(!showPassword);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-all rounded cursor-pointer z-20"
            title={showPassword ? "Hide password" : "Show password (masked for security)"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditOpen(true)}
            className="gap-2"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </Button>

          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Change Password for {username}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="new-pwd">New Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="new-pwd"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Enter new password (min. 6 characters)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirm-pwd">Confirm Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="confirm-pwd"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setEditOpen(false);
                    setNewPassword("");
                    setConfirmPassword("");
                    setError("");
                    setShowNewPassword(false);
                    setShowConfirmPassword(false);
                  }}
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={loading}
                  onClick={handleChangePassword}
                >
                  <Check className="w-4 h-4 mr-1" />
                  {loading ? "Updating..." : "Update"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
