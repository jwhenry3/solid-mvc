import { Component, View, signal } from '@solid-mvc/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { Input, Label } from '@/ui/input';
import { Skeleton, Avatar, Separator } from '@/ui/misc';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import Check from 'lucide-solid/icons/check';

/** The ui/ kitchen sink — every primitive in one place. */
@Component()
export class ComponentsView extends View {
  private dialogOpen = signal(false);
  private tab = signal('account');

  render() {
    return (
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>Buttons & badges</CardTitle>
            <CardDescription>cva variants + tailwind-merge</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="flex flex-wrap gap-2">
              <Button>Default</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="link">Link</Button>
            </div>
            <div class="flex flex-wrap gap-2">
              <Button size="sm">Small</Button>
              <Button size="lg">Large</Button>
              <Button disabled>Disabled</Button>
            </div>
            <Separator />
            <div class="flex flex-wrap gap-2">
              <Badge>default</Badge>
              <Badge variant="secondary">secondary</Badge>
              <Badge variant="outline">outline</Badge>
              <Badge variant="destructive">destructive</Badge>
              <Badge variant="success">success</Badge>
              <Badge variant="warning">warning</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Inputs & avatar</CardTitle>
            <CardDescription>Plain JSX bindings to signals</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="space-y-1.5">
              <Label for="demo-name">Name</Label>
              <Input id="demo-name" placeholder="Ada Lovelace" />
            </div>
            <div class="space-y-1.5">
              <Label for="demo-disabled">Disabled</Label>
              <Input id="demo-disabled" disabled placeholder="disabled" />
            </div>
            <div class="flex items-center gap-3 pt-1">
              <Avatar name="Ada Lovelace" />
              <Avatar name="Grace Hopper" />
              <Avatar name="Alan Turing" />
              <span class="text-xs text-muted-foreground">initials fallback, no image needed</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tabs</CardTitle>
            <CardDescription>Signal-driven, no headless lib</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={this.tab}>
              <TabsList>
                <TabsTrigger value="account">Account</TabsTrigger>
                <TabsTrigger value="billing">Billing</TabsTrigger>
                <TabsTrigger value="api">API</TabsTrigger>
              </TabsList>
              <TabsContent value="account">
                <p class="text-sm text-muted-foreground pt-2">
                  Manage profile, email, and sign-in methods.
                </p>
              </TabsContent>
              <TabsContent value="billing">
                <p class="text-sm text-muted-foreground pt-2">
                  Current plan: <Badge variant="success" class="ml-1">Enterprise</Badge>
                </p>
              </TabsContent>
              <TabsContent value="api">
                <p class="text-sm text-muted-foreground pt-2">3 active keys, last rotated 12d ago.</p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dialog & skeleton</CardTitle>
            <CardDescription>Signal-controlled overlay</CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <Button variant="outline" onClick={() => (this.dialogOpen.value = true)}>
              Open dialog
            </Button>
            <div class="space-y-2">
              <Skeleton class="h-4 w-3/4" />
              <Skeleton class="h-4 w-1/2" />
              <Skeleton class="h-10 w-full" />
            </div>
          </CardContent>
        </Card>

        <Dialog open={this.dialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Worker-rendered?</DialogTitle>
              <DialogDescription>
                This dialog is ordinary JSX on the main thread — but the same ui/
                components would work identically inside an island.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => (this.dialogOpen.value = false)}>
                Cancel
              </Button>
              <Button onClick={() => (this.dialogOpen.value = false)}>
                <Check size={14} /> Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
}
