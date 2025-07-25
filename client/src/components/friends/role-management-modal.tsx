import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Settings,
    Eye,
    Edit3,
    Shield,
    ArrowRight,
    ArrowLeft,
    Info,
    Save,
    X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ProfilePicture } from '@/components/profile/ProfilePicture/ProfilePicture';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface Friend {
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    roleUserToFriend: 'viewer' | 'contributor' | 'editor';
    roleFriendToUser: 'viewer' | 'contributor' | 'editor';
}

interface RoleManagementModalProps {
    friend: Friend | null;
    isOpen: boolean;
    onClose: () => void;
    onRoleUpdated?: (friendId: string, newRoles: { toFriend: string; toUser: string }) => void;
}

const ROLES = [
    {
        value: 'viewer',
        label: 'Viewer',
        icon: Eye,
        description: 'Can view shared journal entries and boards',
        permissions: ['View shared content', 'See board layouts', 'Read notes and comments']
    },
    {
        value: 'contributor',
        label: 'Contributor',
        icon: Edit3,
        description: 'Can view and add new content to shared entries',
        permissions: [
            'All viewer permissions',
            'Create new notes and content blocks',
            'Move and edit their own content',
            'Cannot modify others\' content'
        ]
    },
    {
        value: 'editor',
        label: 'Editor',
        icon: Shield,
        description: 'Full editing permissions on shared content',
        permissions: [
            'All contributor permissions',
            'Edit any content on shared boards',
            'Resize and modify all notes',
            'Delete content blocks',
            'Full collaboration access'
        ]
    }
] as const;

export function RoleManagementModal({
    friend,
    isOpen,
    onClose,
    onRoleUpdated
}: RoleManagementModalProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [roleToFriend, setRoleToFriend] = useState<string>(friend?.roleUserToFriend || 'viewer');
    const [roleToUser, setRoleToUser] = useState<string>(friend?.roleFriendToUser || 'viewer');
    const [hasChanges, setHasChanges] = useState(false);

    // Update role mutation
    const updateRoleMutation = useMutation({
        mutationFn: async ({
            friendshipId,
            roleUserToFriend,
            roleFriendToUser
        }: {
            friendshipId: string;
            roleUserToFriend: string;
            roleFriendToUser: string;
        }) => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            const response = await fetch(`/api/friends/${friendshipId}/role`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    roleUserToFriend,
                    roleFriendToUser
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update roles');
            }

            return response.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['friends'] });
            onRoleUpdated?.(friend!.id, { toFriend: roleToFriend, toUser: roleToUser });

            toast({
                title: "Roles updated successfully",
                description: "Friend permissions have been updated",
            });

            onClose();
        },
        onError: (error) => {
            toast({
                title: "Failed to update roles",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Reset state when friend changes or modal opens
    React.useEffect(() => {
        if (friend && isOpen) {
            setRoleToFriend(friend.roleUserToFriend);
            setRoleToUser(friend.roleFriendToUser);
            setHasChanges(false);
        }
    }, [friend, isOpen]);

    // Check for changes
    React.useEffect(() => {
        if (friend) {
            const changed = roleToFriend !== friend.roleUserToFriend ||
                roleToUser !== friend.roleFriendToUser;
            setHasChanges(changed);
        }
    }, [roleToFriend, roleToUser, friend]);

    const handleSave = () => {
        if (!friend || !hasChanges) return;

        updateRoleMutation.mutate({
            friendshipId: friend.id,
            roleUserToFriend: roleToFriend,
            roleFriendToUser: roleToUser
        });
    };

    const handleCancel = () => {
        if (friend) {
            setRoleToFriend(friend.roleUserToFriend);
            setRoleToUser(friend.roleFriendToUser);
            setHasChanges(false);
        }
        onClose();
    };

    if (!friend) return null;

    const displayName = friend.firstName && friend.lastName
        ? `${friend.firstName} ${friend.lastName}`
        : friend.username;

    return (
        <Dialog open={isOpen} onOpenChange={handleCancel}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Manage Friend Permissions
                    </DialogTitle>
                    <DialogDescription>
                        Configure directional permissions for your friendship with {displayName}
                    </DialogDescription>
                </DialogHeader>

                {/* Friend Info */}
                <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
                    <ProfilePicture
                        userId={friend.id}
                        size="lg"
                        fallbackText={displayName}
                    />
                    <div>
                        <p className="font-medium">{displayName}</p>
                        <p className="text-sm text-muted-foreground">@{friend.username}</p>
                    </div>
                </div>

                <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                        Directional permissions allow you to set different access levels for what you share with your friend
                        versus what they share with you. Changes take effect immediately.
                    </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Your permissions to friend */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <ArrowRight className="h-4 w-4" />
                                Your Content → {displayName}
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                What {displayName} can do with content you share
                            </p>
                        </CardHeader>
                        <CardContent>
                            <RadioGroup
                                value={roleToFriend}
                                onValueChange={setRoleToFriend}
                                className="space-y-4"
                            >
                                {ROLES.map((role) => {
                                    const Icon = role.icon;
                                    return (
                                        <div key={role.value} className="space-y-2">
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value={role.value} id={`to-friend-${role.value}`} />
                                                <Label
                                                    htmlFor={`to-friend-${role.value}`}
                                                    className="flex items-center gap-2 cursor-pointer"
                                                >
                                                    <Icon className="h-4 w-4" />
                                                    {role.label}
                                                </Label>
                                                {roleToFriend === role.value && (
                                                    <Badge variant="secondary" className="text-xs">Selected</Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground ml-6">
                                                {role.description}
                                            </p>
                                            {roleToFriend === role.value && (
                                                <ul className="text-xs text-muted-foreground ml-6 space-y-1">
                                                    {role.permissions.map((permission, index) => (
                                                        <li key={index} className="flex items-center gap-1">
                                                            <span className="w-1 h-1 bg-current rounded-full" />
                                                            {permission}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    );
                                })}
                            </RadioGroup>
                        </CardContent>
                    </Card>

                    {/* Friend's permissions to you */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <ArrowLeft className="h-4 w-4" />
                                {displayName}'s Content → You
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                What you can do with content {displayName} shares
                            </p>
                        </CardHeader>
                        <CardContent>
                            <RadioGroup
                                value={roleToUser}
                                onValueChange={setRoleToUser}
                                className="space-y-4"
                            >
                                {ROLES.map((role) => {
                                    const Icon = role.icon;
                                    return (
                                        <div key={role.value} className="space-y-2">
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value={role.value} id={`to-user-${role.value}`} />
                                                <Label
                                                    htmlFor={`to-user-${role.value}`}
                                                    className="flex items-center gap-2 cursor-pointer"
                                                >
                                                    <Icon className="h-4 w-4" />
                                                    {role.label}
                                                </Label>
                                                {roleToUser === role.value && (
                                                    <Badge variant="secondary" className="text-xs">Selected</Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground ml-6">
                                                {role.description}
                                            </p>
                                            {roleToUser === role.value && (
                                                <ul className="text-xs text-muted-foreground ml-6 space-y-1">
                                                    {role.permissions.map((permission, index) => (
                                                        <li key={index} className="flex items-center gap-1">
                                                            <span className="w-1 h-1 bg-current rounded-full" />
                                                            {permission}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    );
                                })}
                            </RadioGroup>
                        </CardContent>
                    </Card>
                </div>

                <DialogFooter className="flex justify-between">
                    <Button variant="outline" onClick={handleCancel}>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                    </Button>

                    <Button
                        onClick={handleSave}
                        disabled={!hasChanges || updateRoleMutation.isPending}
                    >
                        <Save className="h-4 w-4 mr-2" />
                        {updateRoleMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}